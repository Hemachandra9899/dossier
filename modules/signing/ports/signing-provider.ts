// SigningProvider port — the single boundary through which the Dossier
// application talks to any signature provider. Application code depends on
// this interface only; provider SDKs are confined to modules/signing/providers.

import type { SignatureProviderName } from "../domain/signing-event";

export interface ProviderTemplate {
  provider: SignatureProviderName;
  templateId: string;
  envelopeId: string;
  externalId: string;
}

export interface ProviderEditorSession {
  host: string;
  presignToken: string;
  envelopeId: string;
  externalId: string;
}

export interface ProviderSigningSession {
  host: string;
  token: string;
  externalId: string;
}

export interface ProviderSignedArtifact {
  downloadUrl: string;
  mimeType: "application/pdf";
}

export interface CreateProviderTemplateInput {
  externalId: string;
  title: string;
  fileName: string;
  file: Uint8Array;
}

export interface CreateProviderSigningDocumentInput {
  providerTemplateId: string;
  externalId: string;
  recipients: Array<{
    name: string | null;
    email: string;
    signingOrder: number;
  }>;
}

export interface ProviderSigningDocument {
  /** Primary envelope for the request (the first recipient's document). */
  providerEnvelopeId: string;
  providerDocumentId: number;
  recipients: Array<{
    providerRecipientId: number;
    providerDocumentId: number;
  }>;
}

export interface SigningProvider {
  createTemplate(input: CreateProviderTemplateInput): Promise<ProviderTemplate>;

  createEditorSession(template: ProviderTemplate): Promise<ProviderEditorSession>;

  /**
   * Provisions the provider-side signing request for all recipients. Reuses
   * the proven per-visitor document primitive (no emails sent); `externalId`
   * ties every created document back to the Dossier request.
   */
  createSigningDocument(
    input: CreateProviderSigningDocumentInput,
  ): Promise<ProviderSigningDocument>;

  /**
   * Resolves a recipient's signing token: reuses the already-created per-visitor
   * document when `providerDocumentId` is present, otherwise mints a fresh one.
   */
  createSigningSession(input: {
    providerTemplateId: string;
    providerEnvelopeId: string;
    providerDocumentId?: number | null;
    externalId: string;
    recipient: {
      email?: string | null;
      name?: string | null;
    };
  }): Promise<ProviderSigningSession>;

  getSignedArtifact(input: {
    providerEnvelopeId: string;
    providerDocumentId?: number | null;
  }): Promise<ProviderSignedArtifact>;

  cancelRequest(input: {
    providerEnvelopeId: string;
  }): Promise<void>;
}
