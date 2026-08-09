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

export interface SigningProvider {
  createTemplate(input: CreateProviderTemplateInput): Promise<ProviderTemplate>;

  createEditorSession(template: ProviderTemplate): Promise<ProviderEditorSession>;

  createSigningSession(input: {
    providerTemplateId: string;
    providerEnvelopeId: string;
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
