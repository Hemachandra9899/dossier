// Documenso implementation of the SigningProvider port.
//
// Reuses the proven Papermark->Documenso primitives (template creation, the
// per-visitor `templates.use` signing session, signed download URL minting)
// behind the provider boundary. As the Dossier domain matures, these
// primitives migrate INTO this module; nothing outside
// modules/signing/providers/documenso may touch the Documenso SDK.

import { TeamError } from "@/lib/errorHandler";
import {
  createSigningDocumentFromTemplate,
  createSigningTemplateEnvelope,
} from "@/lib/signing/agreements";
import { getEnvelopeSignedDownloadUrl } from "@/lib/signing/envelopes";

import type {
  CreateProviderTemplateInput,
  ProviderEditorSession,
  ProviderSignedArtifact,
  ProviderSigningSession,
  ProviderTemplate,
  SigningProvider,
} from "../../ports/signing-provider";
import { getDocumensoClient, getDocumensoHost } from "./client";

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

  async createSigningSession(input: {
    providerTemplateId: string;
    providerEnvelopeId: string;
    externalId: string;
    recipient: {
      email?: string | null;
      name?: string | null;
    };
  }): Promise<ProviderSigningSession> {
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
