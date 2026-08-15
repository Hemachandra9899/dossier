// Documenso implementation of the SigningProvider port.
//
// Reuses the proven Papermark->Documenso primitives (template creation, the
// per-visitor `templates.use` signing document, signed download URL minting)
// behind the provider boundary. As the Dossier domain matures, these
// primitives migrate INTO this module; nothing outside
// modules/signing/providers/documenso may touch the Documenso SDK.

import { TeamError } from "@/shared/utils/errorHandler";
import {
  createSigningDocumentFromTemplate,
  createSigningTemplateEnvelope,
  getReusableSigningDocumentSession,
} from "@/shared/utils/signing/agreements";
import { getEnvelope, getEnvelopeSignedDownloadUrl } from "@/shared/utils/signing/envelopes";

import type {
  CreateProviderSigningDocumentInput,
  CreateProviderTemplateInput,
  ProviderEditorSession,
  ProviderSignedArtifact,
  ProviderSigningDocument,
  ProviderSigningSession,
  ProviderTemplate,
  SigningProvider,
} from "../signing-provider";
import { getDocumensoClient, getDocumensoHost } from "./client";

const EDITOR_PRESIGN_TOKEN_EXPIRES_IN_SECONDS = 3600;

class DocumensoSigningProvider implements SigningProvider {
  async createTemplate(
    input: CreateProviderTemplateInput,
  ): Promise<ProviderTemplate> {
    if (!process.env.SIGNING_API_KEY) {
      return {
        provider: "DOCUMENSO",
        templateId: `local_tpl_${Date.now()}`,
        envelopeId: `local_env_${Date.now()}`,
        externalId: input.externalId,
      };
    }

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
    if (!process.env.SIGNING_API_KEY) {
      return {
        host: getDocumensoHost(),
        presignToken: `local_presign_${Date.now()}`,
        envelopeId: template.envelopeId,
        externalId: template.externalId,
      };
    }

    const presignToken =
      await getDocumensoClient().embedding.embeddingPresignCreateEmbeddingPresignToken(
        {
          expiresIn: EDITOR_PRESIGN_TOKEN_EXPIRES_IN_SECONDS,
        },
      );

    return {
      host: getDocumensoHost(),
      presignToken: presignToken.token,
      envelopeId: template.envelopeId,
      externalId: template.externalId,
    };
  }

  // Replace the anonymous "Viewer" recipient seeded at template creation with
  // the request's real recipients so the embedded V2 editor can assign fields
  // per recipient. Returns the per-recipient Documenso recipient ids keyed by
  // (normalized) email for local persistence.
  async syncRecipientsToEnvelope(input: {
    providerTemplateId: string;
    providerEnvelopeId: string;
    recipients: Array<{
      email: string;
      name: string | null;
      signingOrder: number;
    }>;
  }): Promise<Array<{ email: string; providerRecipientId: string }>> {
    if (!process.env.SIGNING_API_KEY) {
      const now = Date.now();
      return input.recipients.map((recipient, index) => ({
        email: recipient.email,
        providerRecipientId: `local_rec_${now}_${index + 1}`,
      }));
    }

    const client = getDocumensoClient();

    // Drop every seeded/anonymous recipient first so the editor only shows the
    // actual signers (fields drawn against a stale viewer would be orphaned).
    const envelope = await getEnvelope(input.providerEnvelopeId);
    for (const recipient of envelope.recipients) {
      await client.envelopes.recipients.delete({
        recipientId: recipient.id,
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

    // Re-read the envelope; match created recipients back by normalized email.
    const updatedEnvelope = await getEnvelope(input.providerEnvelopeId);
    const byEmail = new Map<string, string>();
    for (const recipient of updatedEnvelope.recipients) {
      byEmail.set(recipient.email.trim().toLowerCase(), String(recipient.id));
    }

    return input.recipients.map((recipient) => ({
      email: recipient.email,
      providerRecipientId:
        byEmail.get(recipient.email) ??
        (() => {
          throw new TeamError(
            `Documenso did not return the recipient id for ${recipient.email}.`,
          );
        })(),
    }));
  }

  // Server-side envelope read for send-time field validation. Returns the raw
  // provider envelope (recipients + fields with page/position) so the
  // application layer can deterministically verify fields before sending.
  async getEnvelope(envelopeId: string): Promise<any> {
    if (!process.env.SIGNING_API_KEY) {
      return {
        type: "TEMPLATE",
        status: "DRAFT",
        recipients: [],
        fields: [],
      };
    }
    return getEnvelope(envelopeId);
  }

  // Send the request: mint one per-visitor signing document per recipient via
  // `templates.use`, mapped onto that recipient's template recipient so each
  // link only shows their assigned fields. `distributionMethod: "NONE"` keeps
  // Documenso from emailing; Dossier sends its own invitations. Returns the
  // per-recipient document ids + signing tokens for local persistence.
  async sendEnvelope(input: {
    providerTemplateId: string;
    recipients: Array<{
      providerRecipientId: string;
      email: string;
      name: string | null;
      externalId: string;
    }>;
  }): Promise<
    Array<{
      providerRecipientId: string;
      providerDocumentId: number;
      token: string;
    }>
  > {
    if (!process.env.SIGNING_API_KEY) {
      const now = Date.now();
      return input.recipients.map((recipient, index) => ({
        providerRecipientId: recipient.providerRecipientId,
        providerDocumentId: index + 1,
        token: `local_sign_token_${now}_${index + 1}`,
      }));
    }

    const numericTemplateId = Number(input.providerTemplateId);
    if (!Number.isInteger(numericTemplateId) || numericTemplateId <= 0) {
      throw new TeamError(
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
        throw new TeamError(
          `Documenso did not return a signing token for ${recipient.email}.`,
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

  async createSigningDocument(
    input: CreateProviderSigningDocumentInput,
  ): Promise<ProviderSigningDocument> {
    if (!process.env.SIGNING_API_KEY) {
      const now = Date.now();
      return {
        providerEnvelopeId: `local_env_${now}`,
        providerDocumentId: 1,
        recipients: input.recipients.map((r, i) => ({
          providerRecipientId: i + 1,
          providerDocumentId: i + 1,
        })),
      };
    }

    const documents = [];
    let primary: { envelopeId: string; documentId: number } | null = null;

    for (const recipient of input.recipients) {
      // One per-visitor document per recipient (`templates.use`,
      // distributionMethod "NONE" so Documenso never emails). Every document
      // carries the Dossier request externalId for webhook correlation.
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
      throw new TeamError(
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
    recipient: {
      email?: string | null;
      name?: string | null;
    };
  }): Promise<ProviderSigningSession> {
    if (!process.env.SIGNING_API_KEY) {
      return {
        host: getDocumensoHost(),
        token: `local_sign_token_${Date.now()}`,
        externalId: input.externalId,
      };
    }

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

  async getSignedArtifact(input: {
    providerEnvelopeId: string;
    providerDocumentId?: number | null;
  }): Promise<ProviderSignedArtifact> {
    const { url } = await getEnvelopeSignedDownloadUrl({
      envelopeId: input.providerEnvelopeId,
      documentId: input.providerDocumentId,
    });

    return { downloadUrl: url, mimeType: "application/pdf" };
  }

  async cancelRequest(input: {
    providerEnvelopeId: string;
  }): Promise<void> {
    try {
      await getDocumensoClient().envelopes.delete({
        envelopeId: input.providerEnvelopeId,
      });
    } catch (error) {
      throw new TeamError(
        `Failed to cancel the signing request: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }
}

export const documensoSigningProvider: SigningProvider =
  new DocumensoSigningProvider();
