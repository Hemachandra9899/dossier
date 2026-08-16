import { DocumentStorageType } from "@prisma/client";

import { DocumentRepository } from "../server/document.repository";
import { ProviderEventRepository } from "../server/provider-event.repository";
import { SignatureRequestRepository } from "../server/signature-request.repository";
import { SignatureTemplateRepository } from "../server/signature-template.repository";
import { documensoSigningProvider } from "../providers/documenso/provider";
import { mapDocumensoEventToStatus } from "../providers/documenso/mapper";
import type { SigningProvider } from "../providers/signing-provider";
import { s3Storage } from "@/infrastructure/storage";
import { signedArtifactStorage, SignedArtifactStorage } from "@/infrastructure/storage/signed-artifact-storage";
import { getFile } from "@/shared/utils/files/get-file";
import { sendEmail } from "@/shared/utils/resend";

export type ProviderEventMapper = (event: string) => any;

export type EmailDeliverer = (input: {
  to: string;
  subject: string;
  react: any;
  system?: boolean;
}) => Promise<unknown>;

export interface SigningContext {
  requests: SignatureRequestRepository;
  documents: DocumentRepository;
  events: ProviderEventRepository;
  templates: SignatureTemplateRepository;
  provider: SigningProvider;
  mapEventToStatus: ProviderEventMapper;
  storage: SignedArtifactStorage;
  artifactMirror: any;
  getDocumentFileBytes: (input: { file: string; storageType: any }) => Promise<Buffer>;
  deliverEmail: EmailDeliverer;
  logger: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

export function createSigningContext(overrides?: Partial<SigningContext>): SigningContext {
  const requests = overrides?.requests ?? new SignatureRequestRepository();
  const documents = overrides?.documents ?? new DocumentRepository();
  const events = overrides?.events ?? new ProviderEventRepository();
  const templates = overrides?.templates ?? new SignatureTemplateRepository();
  const provider = overrides?.provider ?? documensoSigningProvider;
  const mapEventToStatus = overrides?.mapEventToStatus ?? mapDocumensoEventToStatus;
  const storage = overrides?.storage ?? signedArtifactStorage;

  const getDocumentFileBytes =
    overrides?.getDocumentFileBytes ??
    (async (input: { file: string; storageType: any }) => {
      const { file, storageType } = input;

      // VERCEL_BLOB files are not reachable through the S3 client; resolve a
      // (server-side) download URL and stream the bytes instead.
      if (storageType === DocumentStorageType.VERCEL_BLOB) {
        const url = await getFile({
          type: DocumentStorageType.VERCEL_BLOB,
          data: file,
          isDownload: true,
        });
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to download document for signing: ${response.status}`,
          );
        }
        return Buffer.from(await response.arrayBuffer());
      }

      const buffer = await s3Storage.getBuffer(file);
      if (!buffer) {
        throw new Error(`File buffer not found in storage for key ${file}`);
      }
      return buffer;
    });

  const logger = overrides?.logger ?? {
    info: (msg: string, ...args: any[]) => console.log(`[SIGNING:INFO] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => console.warn(`[SIGNING:WARN] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`[SIGNING:ERROR] ${msg}`, ...args),
  };

  return {
    requests,
    documents,
    events,
    templates,
    provider,
    mapEventToStatus,
    storage,
    
// Artifact mirror queue adapter using the Trigger.dev SDK.
export const signatureArtifactMirrorQueueAdapter = {
  async enqueue(requestId: string) {
    // Use the installed Trigger.dev SDK's typed task-trigger API.
    await triggerSignatureArtifactMirror({
      requestId,
    });
  },
};
artifactMirror: signatureArtifactMirrorQueueAdapter,
    getDocumentFileBytes,
    deliverEmail: sendEmail,
    logger,
  };
}
