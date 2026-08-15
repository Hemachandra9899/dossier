// The SigningProvider port. Documenso is the only adapter today
// (providers/documenso). Types are deliberately structural: the port is a
// contract the application layer codes against, not a class hierarchy.

export interface ProviderTemplate {
  provider: "DOCUMENSO";
  templateId: string;
  envelopeId: string;
  externalId: string;
}

export interface CreateProviderTemplateInput {
  title: string;
  externalId: string;
  fileName: string;
  file: Uint8Array;
}

export interface ProviderEditorSession {
  host: string;
  presignToken: string;
  envelopeId: string;
  externalId: string;
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
  providerEnvelopeId: string;
  providerDocumentId: number;
  recipients: Array<{
    providerRecipientId: number;
    providerDocumentId: number;
  }>;
}

export interface CreateProviderSigningSessionInput {
  providerTemplateId: string;
  providerEnvelopeId: string;
  providerDocumentId?: number | null;
  externalId: string;
  recipient: {
    email?: string | null;
    name?: string | null;
  };
}

export interface ProviderSigningSession {
  host: string;
  token: string;
  externalId: string;
}

export interface GetProviderSignedArtifactInput {
  providerEnvelopeId: string;
  providerDocumentId?: number | null;
}

export interface ProviderSignedArtifact {
  downloadUrl: string;
  mimeType: string;
}

export interface ProviderEnvelopeField {
  recipientId: number | string;
  type: string;
}

export interface ProviderEnvelope {
  type?: string;
  status?: string;
  recipients: Array<{ id: number; email: string; name: string }>;
  fields: Array<ProviderEnvelopeField>;
}

export interface SyncEnvelopeRecipientsInput {
  providerTemplateId: string;
  providerEnvelopeId: string;
  recipients: Array<{
    email: string;
    name: string | null;
    signingOrder: number;
  }>;
}

export interface SendEnvelopeInput {
  providerTemplateId: string;
  recipients: Array<{
    providerRecipientId: string;
    email: string;
    name: string | null;
    externalId: string;
  }>;
}

export interface SentEnvelopeRecipient {
  providerRecipientId: string;
  providerDocumentId: number;
  token: string;
}

export interface SigningProvider {
  createTemplate(
    input: CreateProviderTemplateInput,
  ): Promise<ProviderTemplate>;
  createEditorSession(
    template: ProviderTemplate,
  ): Promise<ProviderEditorSession>;
  createSigningDocument(
    input: CreateProviderSigningDocumentInput,
  ): Promise<ProviderSigningDocument>;
  createSigningSession(
    input: CreateProviderSigningSessionInput,
  ): Promise<ProviderSigningSession>;
  getSignedArtifact(
    input: GetProviderSignedArtifactInput,
  ): Promise<ProviderSignedArtifact>;
  cancelRequest(input: { providerEnvelopeId: string }): Promise<void>;
  syncRecipientsToEnvelope(
    input: SyncEnvelopeRecipientsInput,
  ): Promise<Array<{ email: string; providerRecipientId: string }>>;
  getEnvelope(envelopeId: string): Promise<ProviderEnvelope>;
  sendEnvelope(
    input: SendEnvelopeInput,
  ): Promise<Array<SentEnvelopeRecipient>>;
}
