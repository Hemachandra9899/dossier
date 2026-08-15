// In-memory fakes for the signing ports, so integration tests never touch a
// real signing provider, S3, Trigger.dev or legacy file storage. The signed
// PDF is served from a tiny local HTTP server so the mirror use-case's real
// fetch() works unchanged.

import http from "http";

import type { SigningContext } from "@/features/signing/application/context";
import { createSigningContext } from "@/features/signing/application/context";
import type {
  ProviderEditorSession,
  ProviderEnvelope,
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

export const SIGNED_PDF_BYTES = Buffer.from("%PDF-1.4 fake signed document");

let server: http.Server | null = null;
let serverUrl: string | null = null;
let providerCounter = 0;

/** Module-level counter so provider ids are globally unique across test runs. */
function nextProviderCounter(): number {
  providerCounter += 1;
  return providerCounter;
}

function startSignedPdfServer(): Promise<string> {
  if (serverUrl) return Promise.resolve(serverUrl);
  return new Promise((resolve, reject) => {
    const httpServer = http.createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Length": String(SIGNED_PDF_BYTES.byteLength),
      });
      res.end(SIGNED_PDF_BYTES);
    });
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to bind signed PDF server"));
        return;
      }
      server = httpServer;
      serverUrl = `http://127.0.0.1:${address.port}/signed.pdf`;
      resolve(serverUrl);
    });
  });
}

export async function stopSignedPdfServer(): Promise<void> {
  if (!server) return;
  const current = server;
  server = null;
  serverUrl = null;
  await new Promise<void>((resolve) => current.close(() => resolve()));
}

export class FakeSigningProvider implements SigningProvider {
  createTemplateCalls = 0;
  createSigningDocumentCalls = 0;
  createSigningSessionCalls = 0;
  cancelRequestCalls: string[] = [];
  failCreateTemplate = false;
  failCreateSigningDocument = false;
  failGetSignedArtifact = false;

  envelopeRecipients: Array<{ id: number; email: string; name: string }> = [];
  envelopeFields: Array<{ recipientId: number | string; type: string }> = [];
  sentEnvelopes: Array<{
    providerTemplateId: string;
    recipients: Array<{
      providerRecipientId: string;
      email: string;
      name: string | null;
      externalId: string;
    }>;
  }> = [];

  async createTemplate(input: {
    externalId: string;
    title: string;
    fileName: string;
    file: Uint8Array;
  }): Promise<ProviderTemplate> {
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

  async createSigningDocument(input: {
    providerTemplateId: string;
    externalId: string;
    recipients: Array<{ name: string | null; email: string; signingOrder: number }>;
  }): Promise<ProviderSigningDocument> {
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

  async getSignedArtifact(): Promise<ProviderSignedArtifact> {
    if (this.failGetSignedArtifact) {
      throw new Error("fake provider: getSignedArtifact failed");
    }
    return {
      downloadUrl: await startSignedPdfServer(),
      mimeType: "application/pdf",
    };
  }

  async cancelRequest(input: { providerEnvelopeId: string }): Promise<void> {
    this.cancelRequestCalls.push(input.providerEnvelopeId);
  }

  async syncRecipientsToEnvelope(
    input: SyncEnvelopeRecipientsInput,
  ): Promise<Array<{ email: string; providerRecipientId: string }>> {
    this.envelopeRecipients = input.recipients.map((r, index) => ({
      id: index + 1,
      email: r.email,
      name: r.name ?? "",
    }));
    return input.recipients.map((r, index) => ({
      email: r.email,
      providerRecipientId: String(index + 1),
    }));
  }

  async getEnvelope(): Promise<ProviderEnvelope> {
    return {
      type: "TEMPLATE",
      status: "DRAFT",
      recipients: this.envelopeRecipients,
      fields: this.envelopeFields,
    };
  }

  async sendEnvelope(input: SendEnvelopeInput): Promise<SentEnvelopeRecipient[]> {
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
