// In-memory fakes for the signing ports, so integration tests never touch a
// real signing provider, S3, Trigger.dev or legacy file storage.

import type { SigningContext } from "@/features/signing/application/context";
import { createSigningContext } from "@/features/signing/application/context";
import type {
  CreateEnvelopeInput,
  CreateProviderSigningDocumentInput,
  CreateProviderTemplateInput,
  ProviderEditorSession,
  ProviderEnvelope,
  ProviderEnvelopeCreated,
  ProviderEnvelopeDistributed,
  ProviderEnvelopeItem,
  ProviderEnvelopeRecipient,
  ProviderSigningDocument,
  ProviderSigningSession,
  ProviderSignedArtifact,
  ProviderTemplate,
  SendEnvelopeInput,
  SentEnvelopeRecipient,
  SigningProvider,
  SyncEnvelopeRecipientsInput,
} from "@/features/signing/providers/signing-provider";
import { mapDocumensoEventToStatus } from "@/features/signing/providers/documenso/mapper";
import type { SignedArtifactStorage } from "@/platform/storage";

const silentLogger: SigningContext["logger"] = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export const SIGNED_PDF_BYTES = new Uint8Array([
  37, 80, 68, 70, 45, 49, 46, 52, 32, 102, 97, 107, 101, 32, 115, 105, 103, 110, 101, 100, 32, 100, 111, 99,
  117, 109, 101, 110, 116,
]);

let providerCounter = 0;

/** Module-level counter so provider ids are globally unique across test runs. */
function nextProviderCounter(): number {
  providerCounter += 1;
  return providerCounter;
}

export class FakeSigningProvider implements SigningProvider {
  createTemplateCalls = 0;
  createSigningDocumentCalls = 0;
  createSigningSessionCalls = 0;
  cancelRequestCalls: string[] = [];
  failCreateTemplate = false;
  failCreateSigningDocument = false;
  failGetSignedArtifact = false;

  // For envelope flow
  envelopeId = `fake_envelope_${nextProviderCounter()}`;
  envelopeRecipients: Array<{
    providerRecipientId: number;
    email: string;
    name: string;
    signingStatus: string;
    sendStatus: string;
    readStatus: string;
  }> = [];
  envelopeFields: Array<{
    recipientId: number;
    type: string;
    envelopeItemId: string;
  }> = [];
  envelopeItems: ProviderEnvelopeItem[] = [
    { id: "fake_item_1", order: 1, title: "Document" },
  ];
  distributed = false;
  sentEnvelopes: Array<{
    providerTemplateId: string;
    recipients: Array<{
      providerRecipientId: string;
      email: string;
      name: string | null;
      externalId: string;
    }>;
  }> = [];

  // --- Envelope flow (primary) ---

  async createEnvelope(
    input: CreateEnvelopeInput,
  ): Promise<ProviderEnvelopeCreated> {
    this.envelopeId = `fake_envelope_${nextProviderCounter()}`;
    this.envelopeRecipients = input.recipients.map((r, index) => ({
      providerRecipientId: index + 1,
      email: r.email,
      name: r.name ?? "",
      signingStatus: "NOT_SIGNED",
      sendStatus: "NOT_SENT",
      readStatus: "NOT_OPENED",
    }));
    this.envelopeFields = [];
    this.envelopeItems = [{ id: "fake_item_1", order: 1, title: input.fileName }];
    this.distributed = false;

    return {
      providerEnvelopeId: this.envelopeId,
      recipients: input.recipients.map((_, index) => ({
        email: input.recipients[index].email,
        providerRecipientId: index + 1,
      })),
    };
  }

  async createEditorSessionForEnvelope(): Promise<ProviderEditorSession> {
    return {
      host: "https://sign.fake.test",
      presignToken: "fake_presign_token",
      envelopeId: this.envelopeId,
      externalId: "fake_external_editor",
    };
  }

  async getEnvelope(envelopeId: string): Promise<ProviderEnvelope> {
    return {
      provider: "DOCUMENSO",
      envelopeId,
      type: "DOCUMENT",
      status: this.distributed ? "PENDING" : "DRAFT",
      recipients: this.envelopeRecipients.map((r) => ({
        providerRecipientId: r.providerRecipientId,
        email: r.email,
        name: r.name,
        signingStatus: r.signingStatus,
        sendStatus: r.sendStatus,
        readStatus: r.readStatus,
      })),
      fields: this.envelopeFields,
      envelopeItems: this.envelopeItems,
    };
  }

  async distributeEnvelope(): Promise<ProviderEnvelopeDistributed> {
    this.distributed = true;
    // Update recipient statuses
    this.envelopeRecipients = this.envelopeRecipients.map((r) => ({
      ...r,
      sendStatus: "SENT",
    }));
    return {
      providerEnvelopeId: this.envelopeId,
      recipients: this.envelopeRecipients.map((r) => ({
        providerRecipientId: r.providerRecipientId,
        email: r.email,
        name: r.name,
        signingStatus: r.signingStatus,
        sendStatus: r.sendStatus,
        readStatus: r.readStatus,
        signingUrl: `https://sign.fake.test/sign/${r.providerRecipientId}`,
        token: `fake_token_${r.providerRecipientId}`,
      })),
    };
  }

  async getRecipientSigningSession(): Promise<ProviderSigningSession> {
    return {
      host: "https://sign.fake.test",
      token: "fake_session_token",
      externalId: "fake_external_session",
    };
  }

  async getSignedArtifact(): Promise<ProviderSignedArtifact> {
    if (this.failGetSignedArtifact) {
      throw new Error("fake provider: getSignedArtifact failed");
    }
    return {
      bytes: SIGNED_PDF_BYTES,
      mimeType: "application/pdf",
    };
  }

  async cancelRequest(input: { providerEnvelopeId: string }): Promise<void> {
    this.cancelRequestCalls.push(input.providerEnvelopeId);
  }

  // --- Template flow (legacy) ---

  async createTemplate(
    input: CreateProviderTemplateInput,
  ): Promise<ProviderTemplate> {
    this.createTemplateCalls += 1;
    if (this.failCreateTemplate) {
      throw new Error("fake provider: createTemplate failed");
    }
    return {
      provider: "DOCUMENSO",
      templateId: `fake_template_${nextProviderCounter()}`,
      envelopeId: `fake_envelope_${nextProviderCounter()}`,
      externalId: input.externalId,
    };
  }

  async createEditorSession(): Promise<ProviderEditorSession> {
    return {
      host: "https://sign.fake.test",
      presignToken: "fake_presign_token",
      envelopeId: "fake_envelope_editor",
      externalId: "fake_external_editor",
    };
  }

  async createSigningDocument(
    input: CreateProviderSigningDocumentInput,
  ): Promise<ProviderSigningDocument> {
    this.createSigningDocumentCalls += 1;
    if (this.failCreateSigningDocument) {
      throw new Error("fake provider: createSigningDocument failed");
    }
    const envelopeId = `fake_envelope_${nextProviderCounter()}`;
    const documentId = nextProviderCounter();
    return {
      providerEnvelopeId: envelopeId,
      providerDocumentId: documentId,
      recipients: input.recipients.map((_, index) => ({
        providerRecipientId: nextProviderCounter(),
        providerDocumentId: documentId,
      })),
    };
  }

  async createSigningSession(): Promise<ProviderSigningSession> {
    this.createSigningSessionCalls += 1;
    return {
      host: "https://sign.fake.test",
      token: `fake_session_token_${this.createSigningSessionCalls}`,
      externalId: "fake_external_session",
    };
  }

  async syncRecipientsToEnvelope(
    input: SyncEnvelopeRecipientsInput,
  ): Promise<Array<{ email: string; providerRecipientId: string }>> {
    this.envelopeRecipients = input.recipients.map((r, index) => ({
      providerRecipientId: index + 1,
      email: r.email,
      name: r.name ?? "",
      signingStatus: "NOT_SIGNED",
      sendStatus: "NOT_SENT",
      readStatus: "NOT_OPENED",
    }));
    return input.recipients.map((r, index) => ({
      email: r.email,
      providerRecipientId: String(index + 1),
    }));
  }

  async sendEnvelope(
    input: SendEnvelopeInput,
  ): Promise<SentEnvelopeRecipient[]> {
    this.sentEnvelopes.push(input);
    return input.recipients.map((recipient, index) => ({
      providerRecipientId: recipient.providerRecipientId,
      providerDocumentId: index + 1,
      token: `fake_sign_token_${recipient.providerRecipientId}`,
    }));
  }
}

export class FakeArtifactStorage implements SignedArtifactStorage {
  uploads: Array<{ teamId: string; requestId: string; bytes: Buffer }> = [];

  async putSignedPdf(
    teamId: string,
    requestId: string,
    bytes: Buffer | Uint8Array,
  ): Promise<string> {
    const body = Buffer.from(bytes);
    this.uploads.push({ teamId, requestId, bytes: body });
    return `s3://fake-signed/${teamId}/${requestId}.pdf`;
  }

  async getSignedPdf(_teamId: string, _requestId: string): Promise<Buffer | null> {
    return null;
  }

  async getSignedPdfDownloadUrl(
    _teamId: string,
    _requestId: string,
  ): Promise<string> {
    return "https://sign.fake.test/signed.pdf";
  }
}

export class FakeMirrorHandoff {
  enqueued: string[] = [];
  /** Optional runner mirroring the Trigger task: executes the mirror inline. */
  runner?: (requestId: string) => Promise<unknown>;

  async enqueue(requestId: string): Promise<void> {
    this.enqueued.push(requestId);
    if (this.runner) {
      await this.runner(requestId);
    }
  }
}

const fakeDocumentFileBytes = new Uint8Array([37, 80, 68, 70]); // "%PDF"

export interface TestSigningContextOptions {
  provider?: FakeSigningProvider;
  storage?: FakeArtifactStorage;
  mirror?: FakeMirrorHandoff;
  /** When true the mirror handoff runs inline on every enqueue (Trigger emulation). */
  runMirrorInline?: boolean;
}

export function buildTestSigningContext(
  options: TestSigningContextOptions = {},
): SigningContext {
  const provider = options.provider ?? new FakeSigningProvider();
  const storage = options.storage ?? new FakeArtifactStorage();
  const mirror = options.mirror ?? new FakeMirrorHandoff();

  if (options.runMirrorInline) {
    mirror.runner = async (requestId) => {
      const { mirrorSignedArtifact } = await import(
        "@/features/signing/application/mirror-signed-artifact"
      );
      await mirrorSignedArtifact(
        createSigningContext({
          provider,
          storage,
          getDocumentFileBytes: async () => Buffer.from(fakeDocumentFileBytes),
          artifactMirror: mirror,
          mapEventToStatus: mapDocumensoEventToStatus,
          logger: silentLogger,
        }),
        { requestId },
      );
    };
  }

  return createSigningContext({
    provider,
    storage,
    getDocumentFileBytes: async () => Buffer.from(fakeDocumentFileBytes),
    deliverEmail: async () => ({ id: "mock-email-id" }),
    artifactMirror: mirror,
    mapEventToStatus: mapDocumensoEventToStatus,
    logger: silentLogger,
  });
}