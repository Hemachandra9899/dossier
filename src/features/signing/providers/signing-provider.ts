// The SigningProvider port. Documenso is the only adapter today
// (providers/documenso). Types are deliberately structural: the port is a
// contract the application layer codes against, not a class hierarchy.
//
// The primary flow is the ENVELOPE flow: one DOCUMENT envelope per signature
// request (createEnvelope) that recipients sign through a shared embed
// (getRecipientSigningSession). The legacy TEMPLATE methods below it are kept
// for the existing template-based request flow and its integration tests.

// ---------------------------------------------------------------------------
// Envelope flow (primary)
// ---------------------------------------------------------------------------

export interface CreateEnvelopeRecipient {
  email: string;
  name: string | null;
  signingOrder: number;
}

export interface CreateEnvelopeInput {
  title: string;
  externalId: string;
  fileName: string;
  file: Uint8Array;
  recipients: CreateEnvelopeRecipient[];
}

export interface ProviderEnvelopeCreated {
  providerEnvelopeId: string;
  recipients: Array<{ email: string; providerRecipientId: number }>;
}

export interface ProviderEnvelopeRecipient {
  providerRecipientId: number;
  email: string;
  name: string;
  signingStatus: string;
  sendStatus: string;
  readStatus: string;
  signingUrl?: string;
  token?: string;
}

export interface ProviderEnvelopeField {
  recipientId: number;
  type: string;
  envelopeItemId: string;
}

export interface ProviderEnvelopeItem {
  id: string;
  order: number;
  title: string;
}

export interface ProviderEnvelope {
  provider: "DOCUMENSO";
  envelopeId: string;
  type: string;
  status: string;
  recipients: ProviderEnvelopeRecipient[];
  fields: ProviderEnvelopeField[];
  envelopeItems: ProviderEnvelopeItem[];
}

export interface ProviderEnvelopeDistributed {
  providerEnvelopeId: string;
  recipients: ProviderEnvelopeRecipient[];
}

export interface GetRecipientSigningSessionInput {
  providerEnvelopeId: string;
  providerRecipientId: number;
  externalId: string;
}

export interface ProviderSignedArtifact {
  bytes: Uint8Array;
  mimeType: string;
}

// ---------------------------------------------------------------------------
// Template flow (legacy)
// ---------------------------------------------------------------------------

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
  // --- Envelope flow (primary). Fail-closed: no local/test fallbacks. ---
  createEnvelope(input: CreateEnvelopeInput): Promise<ProviderEnvelopeCreated>;
  createEditorSessionForEnvelope(input: {
    providerEnvelopeId: string;
    externalId: string;
  }): Promise<ProviderEditorSession>;
  getEnvelope(envelopeId: string): Promise<ProviderEnvelope>;
  distributeEnvelope(input: {
    providerEnvelopeId: string;
  }): Promise<ProviderEnvelopeDistributed>;
  getRecipientSigningSession(
    input: GetRecipientSigningSessionInput,
  ): Promise<ProviderSigningSession>;
  getSignedArtifact(
    input: GetProviderSignedArtifactInput,
  ): Promise<ProviderSignedArtifact>;
  cancelRequest(input: { providerEnvelopeId: string }): Promise<void>;

  // --- Template flow (legacy, kept for the existing request flow). ---
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
  syncRecipientsToEnvelope(
    input: SyncEnvelopeRecipientsInput,
  ): Promise<Array<{ email: string; providerRecipientId: string }>>;
  sendEnvelope(
    input: SendEnvelopeInput,
  ): Promise<Array<SentEnvelopeRecipient>>;
}
