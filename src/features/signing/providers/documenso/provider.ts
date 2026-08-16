// Documenso implementation of the SigningProvider port.
//
// The primary envelope flow creates ONE DOCUMENT envelope per signature request
// with all signers as recipients and calls the provider only through the v2
// SDK / raw REST. The envelope-flow methods are fail-closed: they never fall
// back to local/test placeholders — missing configuration throws a typed
// SigningProviderError so a request can never be "initialized" against a
// no-op provider.
//
// The legacy template-flow methods below are kept for the existing
// template-based request flow (createTemplate -> createSigningDocument); they
// are also fail-closed and are only exercised through the test fake provider.

import {
  createSigningDocumentFromTemplate,
  createSigningTemplateEnvelope,
  getReusableSigningDocumentSession,
} from "@/shared/utils/signing/agreements";

import { getSigningConfig } from "../../config/signing-config";
import { SigningProviderError } from "../../domain/signing-errors";

import type {
  CreateEnvelopeInput,
  CreateProviderSigningDocumentInput,
  CreateProviderTemplateInput,
  ProviderEditorSession,
  ProviderEnvelope,
  ProviderEnvelopeCreated,
  ProviderEnvelopeDistributed,
  ProviderSignedArtifact,
  ProviderSigningDocument,
  ProviderSigningSession,
  ProviderTemplate,
  SigningProvider,
} from "../signing-provider";
import { getDocumensoClient, getDocumensoHost } from "./client";
import { downloadEnvelopeItemSignedPdf } from "./request";

const EDITOR_PRESIGN_TOKEN_EXPIRES_IN_SECONDS = 3600;

const fieldRecipientId = (field: {
  recipientId?: number | string;
}): number => Number(field.recipientId);

class DocumensoSigningProvider implements SigningProvider {
  // ---------------------------------------------------------------------
  // Envelope flow (primary, fail-closed)
  // ---------------------------------------------------------------------

  async createEnvelope(
    input: CreateEnvelopeInput,
  ): Promise<ProviderEnvelopeCreated> {
    getSigningConfig();
    const client = getDocumensoClient();

    const created = await client.envelopes.create({
      payload: {
        title: input.title,
        type: "DOCUMENT",
        externalId: input.externalId,
        recipients: input.recipients.map((recipient) => ({
          email: recipient.email,
          name: recipient.name ?? "",
          role: "SIGNER",
          signingOrder: recipient.signingOrder,
        })),
        meta: {
          // Dossier owns invitations/emails; Documenso must never email.
          distributionMethod: "NONE",
          signingOrder:
            new Set(input.recipients.map((recipient) => recipient.signingOrder))
              .size > 1
              ? "SEQUENTIAL"
              : "PARALLEL",
        },
      },
      files: [{ fileName: input.fileName, content: input.file }],
    });

    const envelope = await this.getEnvelope(created.id);
    const byEmail = new Map(
      envelope.recipients.map((recipient) => [
        recipient.email.trim().toLowerCase(),
        recipient.providerRecipientId,
      ]),
    );

    return {
      providerEnvelopeId: created.id,
      recipients: input.recipients.map((recipient) => {
        const providerRecipientId = byEmail.get(
          recipient.email.trim().toLowerCase(),
        );
        if (!providerRecipientId) {
          throw new SigningProviderError(
            `The signing provider did not return a recipient id for ${recipient.email}.`,
          );
        }
        return { email: recipient.email, providerRecipientId };
      }),
    };
  }

  async createEditorSessionForEnvelope(input: {
    providerEnvelopeId: string;
    externalId: string;
  }): Promise<ProviderEditorSession> {
    getSigningConfig();
    const presignToken =
      await getDocumensoClient().embedding.embeddingPresignCreateEmbeddingPresignToken(
        {
          expiresIn: EDITOR_PRESIGN_TOKEN_EXPIRES_IN_SECONDS,
        },
      );

    return {
      host: getDocumensoHost(),
      presignToken: presignToken.token,
      envelopeId: input.providerEnvelopeId,
      externalId: input.externalId,
    };
  }

  async getEnvelope(envelopeId: string): Promise<ProviderEnvelope> {
    getSigningConfig();
    const envelope = await getDocumensoClient().envelopes.get({ envelopeId });

    return {
      provider: "DOCUMENSO",
      envelopeId: envelope.id,
      type: envelope.type,
      status: envelope.status,
      recipients: envelope.recipients.map((recipient) => ({
        providerRecipientId: recipient.id,
        email: recipient.email,
        name: recipient.name,
        signingStatus: recipient.signingStatus,
        sendStatus: recipient.sendStatus,
        readStatus: recipient.readStatus,
        signingUrl: undefined,
        token: undefined,
      })),
      fields: envelope.fields.map((field) => ({
        recipientId: fieldRecipientId(field),
        type: field.type,
        envelopeItemId: field.envelopeItemId,
      })),
      envelopeItems: envelope.envelopeItems.map((item) => ({
        id: item.id,
        order: item.order,
        title: item.title,
      })),
    };
  }

  // Distribute the ONE envelope exactly once (guarded by the application
  // layer's state machine). `distributionMethod: "NONE"` keeps Documenso from
  // emailing; Dossier sends its own invitations.
  async distributeEnvelope(input: {
    providerEnvelopeId: string;
  }): Promise<ProviderEnvelopeDistributed> {
    getSigningConfig();
    const distributed = await getDocumensoClient().envelopes.distribute({
      envelopeId: input.providerEnvelopeId,
      meta: { distributionMethod: "NONE" },
    });

    return {
      providerEnvelopeId: distributed.id,
      recipients: distributed.recipients.map((recipient) => ({
        providerRecipientId: recipient.id,
        email: recipient.email,
        name: recipient.name,
        signingStatus: "NOT_SIGNED",
        sendStatus: "SENT",
        readStatus: "NOT_OPENED",
        signingUrl: recipient.signingUrl,
        token: recipient.token,
      })),
    };
  }

  // Recipient signing: mint a fresh session token for one recipient of the
  // request's envelope (shared embed). Tokens are short-lived and never
  // persisted by Dossier.
  async getRecipientSigningSession(input: {
    providerEnvelopeId: string;
    providerRecipientId: number;
    externalId: string;
  }): Promise<ProviderSigningSession> {
    getSigningConfig();
    const recipient = await getDocumensoClient().envelopes.recipients.get({
      recipientId: input.providerRecipientId,
    });

    if (!recipient.token) {
      throw new SigningProviderError(
        "The signing provider did not return a signing token for the recipient.",
      );
    }

    return {
      host: getDocumensoHost(),
      token: recipient.token,
      externalId: input.externalId,
    };
  }

  async getSignedArtifact(input: {
    providerEnvelopeId: string;
    providerDocumentId?: number | null;
  }): Promise<ProviderSignedArtifact> {
    const envelope = await this.getEnvelope(input.providerEnvelopeId);

    const primary =
      envelope.envelopeItems.find((item) => item.order === 1) ??
      envelope.envelopeItems[0];
    if (!primary) {
      throw new SigningProviderError(
        "The signing provider envelope has no document to download.",
      );
    }

    return downloadEnvelopeItemSignedPdf(primary.id);
  }

  async cancelRequest(input: {
    providerEnvelopeId: string;
  }): Promise<void> {
    getSigningConfig();
    try {
      await getDocumensoClient().envelopes.delete({
        envelopeId: input.providerEnvelopeId,
      });
    } catch (error) {
      throw new SigningProviderError(
        `Failed to cancel the signing request: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        { cause: error },
      );
    }
  }

  // ---------------------------------------------------------------------
  // Template flow (legacy; fail-closed — the test fake provider is used in
  // tests, so these methods only run against a configured real provider)
  // ---------------------------------------------------------------------

  async createTemplate(
    input: CreateProviderTemplateInput,
  ): Promise<ProviderTemplate> {
    getSigningConfig();

    const template = await createSigningTemplateEnvelope({
      title: input.title,
      externalId: input.externalId,
      file: {
        fileName: input.fileName,
        content: input.file,
      },
    });

    return {
      provider: "DOCUMENSO",
      templateId: String(template.id),
      envelopeId: template.envelopeId,
      externalId: input.externalId,
    };
  }

  async createEditorSession(
    template: ProviderTemplate,
  ): Promise<ProviderEditorSession> {
    return this.createEditorSessionForEnvelope({
      providerEnvelopeId: template.envelopeId,
      externalId: template.externalId,
    });
  }

  async createSigningDocument(
    input: CreateProviderSigningDocumentInput,
  ): Promise<ProviderSigningDocument> {
    getSigningConfig();

    const documents: Array<{
      providerRecipientId: number;
      providerDocumentId: number;
    }> = [];
    let primary: { envelopeId: string; documentId: number } | null = null;

    for (const recipient of input.recipients) {
      const session = await createSigningDocumentFromTemplate({
        signingTemplateId: input.providerTemplateId,
        externalId: input.externalId,
        signerEmail: recipient.email,
        signerName: recipient.name,
      });

      primary ??= {
        envelopeId: session.envelopeId,
        documentId: session.documentId,
      };

      documents.push({
        providerRecipientId: session.recipientId,
        providerDocumentId: session.documentId,
      });
    }

    if (!primary) {
      throw new SigningProviderError(
        "Failed to initialize the signing request: no recipients were created.",
      );
    }

    return {
      providerEnvelopeId: primary.envelopeId,
      providerDocumentId: primary.documentId,
      recipients: documents,
    };
  }

  async createSigningSession(input: {
    providerTemplateId: string;
    providerEnvelopeId: string;
    providerDocumentId?: number | null;
    externalId: string;
    recipient: { email?: string | null; name?: string | null };
  }): Promise<ProviderSigningSession> {
    getSigningConfig();

    // Re-open path: reuse the recipient's existing per-visitor document token
    // so re-visits don't spawn duplicate documents.
    if (input.providerDocumentId) {
      const reused = await getReusableSigningDocumentSession({
        documentId: input.providerDocumentId,
      });

      if (reused) {
        return {
          host: getDocumensoHost(),
          token: reused.token,
          externalId: input.externalId,
        };
      }
    }

    const session = await createSigningDocumentFromTemplate({
      signingTemplateId: input.providerTemplateId,
      externalId: input.externalId,
      signerEmail: input.recipient.email,
      signerName: input.recipient.name,
    });

    return {
      host: getDocumensoHost(),
      token: session.token,
      externalId: input.externalId,
    };
  }

  async syncRecipientsToEnvelope(input: {
    providerTemplateId: string;
    providerEnvelopeId: string;
    recipients: Array<{
      email: string;
      name: string | null;
      signingOrder: number;
    }>;
  }): Promise<Array<{ email: string; providerRecipientId: string }>> {
    getSigningConfig();
    const client = getDocumensoClient();

    const envelope = await this.getEnvelope(input.providerEnvelopeId);
    for (const recipient of envelope.recipients) {
      await client.envelopes.recipients.delete({
        recipientId: recipient.providerRecipientId,
      });
    }

    await client.envelopes.recipients.createMany({
      envelopeId: input.providerEnvelopeId,
      data: input.recipients.map((recipient) => ({
        email: recipient.email,
        name: recipient.name ?? "",
        role: "SIGNER",
        signingOrder: recipient.signingOrder,
      })),
    });

    const updated = await this.getEnvelope(input.providerEnvelopeId);
    const byEmail = new Map(
      updated.recipients.map((recipient) => [
        recipient.email.trim().toLowerCase(),
        String(recipient.providerRecipientId),
      ]),
    );

    return input.recipients.map((recipient) => {
      const providerRecipientId = byEmail.get(
        recipient.email.trim().toLowerCase(),
      );
      if (!providerRecipientId) {
        throw new SigningProviderError(
          `The signing provider did not return a recipient id for ${recipient.email}.`,
        );
      }
      return { email: recipient.email, providerRecipientId };
    });
  }

  async sendEnvelope(input: {
    providerTemplateId: string;
    recipients: Array<{
      providerRecipientId: string;
      email: string;
      name: string | null;
      externalId: string;
    }>;
  }): Promise<
    Array<{ providerRecipientId: string; providerDocumentId: number; token: string }>
  > {
    getSigningConfig();

    const numericTemplateId = Number(input.providerTemplateId);
    if (!Number.isInteger(numericTemplateId) || numericTemplateId <= 0) {
      throw new SigningProviderError(
        "The signing template id is invalid; please re-upload the document.",
      );
    }

    const client = getDocumensoClient();
    const results: Array<{
      providerRecipientId: string;
      providerDocumentId: number;
      token: string;
    }> = [];

    for (const recipient of input.recipients) {
      const document = await client.templates.use({
        templateId: numericTemplateId,
        externalId: recipient.externalId,
        distributeDocument: true,
        recipients: [
          {
            id: Number(recipient.providerRecipientId),
            email: recipient.email,
            name: recipient.name ?? undefined,
          },
        ],
        override: {
          distributionMethod: "NONE",
        },
      });

      const matched =
        document.recipients.find((item) => item.token) ??
        document.recipients[0];

      if (!matched?.token) {
        throw new SigningProviderError(
          `The signing provider did not return a signing token for ${recipient.email}.`,
        );
      }

      results.push({
        providerRecipientId: recipient.providerRecipientId,
        providerDocumentId: document.id,
        token: matched.token,
      });
    }

    return results;
  }
}

export const documensoSigningProvider: SigningProvider =
  new DocumensoSigningProvider();
