// In-memory fakes for the signing ports, so integration tests never touch a
// real signing provider, S3, Trigger.dev or legacy file storage. The signed
// PDF is served from a tiny local HTTP server so the mirror use-case's real
// fetch() works unchanged.

import http from "http";

import type { SigningContext } from "@/modules/signing/application/context";
import { createSigningContext } from "@/modules/signing/application/context";
import type {
  ProviderEditorSession,
  ProviderSigningDocument,
  ProviderSigningSession,
  ProviderSignedArtifact,
  ProviderTemplate,
  SigningProvider,
} from "@/modules/signing/provider/signing-provider";
import { mapDocumensoEventToStatus } from "@/modules/signing/provider/documenso/mapper";
import type { SignedArtifactStorage } from "@/modules/signing/storage/signed-artifact-storage";
import { testPrisma } from "./test-db";

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
}

export class FakeArtifactStorage implements SignedArtifactStorage {
  uploads: Array<{ requestId: string; fileName: string; body: Buffer }> = [];

  async upload(input: {
    teamId: string;
    requestId: string;
    fileName: string;
    body: Buffer;
  }): Promise<{ storageKey: string }> {
    this.uploads.push({
      requestId: input.requestId,
      fileName: input.fileName,
      body: input.body,
    });
    return { storageKey: `s3://fake-signed/${input.requestId}.pdf` };
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
        "@/modules/signing/application/mirror-signed-artifact"
      );
      await mirrorSignedArtifact(
        createSigningContext({
          prisma: testPrisma,
          provider,
          storage,
          getDocumentFileBytes: async () => fakeDocumentFileBytes,
          artifactMirror: mirror,
          mapEventToStatus: mapDocumensoEventToStatus,
          getSigningHost: () => "https://sign.fake.test",
          logger: silentLogger,
        }),
        { requestId },
      );
    };
  }

  return createSigningContext({
    prisma: testPrisma,
    provider,
    storage,
    getDocumentFileBytes: async () => fakeDocumentFileBytes,
    artifactMirror: mirror,
    mapEventToStatus: mapDocumensoEventToStatus,
    getSigningHost: () => "https://sign.fake.test",
    logger: silentLogger,
  });
}
