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
import { getEnvelopeSignedDownloadUrl } from "@/shared/utils/signing/envelopes";

import type {
  CreateProviderSigningDocumentInput,
  CreateProviderTemplateInput,
  ProviderEditorSession,
  ProviderSignedArtifact,
  ProviderSigningDocument,
  ProviderSigningSession,
  ProviderTemplate,
  SigningProvider,
} from "./signing-provider";
import { getDocumensoClient, getDocumensoHost } from "./documenso/client";

const EDITOR_PRESIGN_TOKEN_EXPIRES_IN_SECONDS = 3600;

class DocumensoSigningProvider implements SigningProvider {
  async createTemplate(
    input: CreateProviderTemplateInput,
  ): Promise<ProviderTemplate> {
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

  async createSigningDocument(
    input: CreateProviderSigningDocumentInput,
  ): Promise<ProviderSigningDocument> {
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
