import { DocumentStorageType } from "@prisma/client";

import { DocumentRepository } from "../server/document.repository";
import { ProviderEventRepository } from "../server/provider-event.repository";
import { SignatureFieldRepository } from "../server/signature-field.repository";
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

export interface ArtifactMirrorQueue {
  enqueue(requestId: string): Promise<void>;
}

export interface SigningContext {
  requests: SignatureRequestRepository;
  documents: DocumentRepository;
  events: ProviderEventRepository;
  templates: SignatureTemplateRepository;
  fields: SignatureFieldRepository;
  provider: SigningProvider;
  mapEventToStatus: ProviderEventMapper;
  storage: SignedArtifactStorage;
  artifactMirror: ArtifactMirrorQueue;
  getDocumentFileBytes: (input: { file: string; storageType: any }) => Promise<Buffer>;
  getSourceUrl: (input: { file: string; storageType: any }) => Promise<string>;
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
  const fields = overrides?.fields ?? new SignatureFieldRepository();
  const provider = overrides?.provider ?? documensoSigningProvider;
  const mapEventToStatus = overrides?.mapEventToStatus ?? mapDocumensoEventToStatus;
  const storage = overrides?.storage ?? signedArtifactStorage;
  const artifactMirror = overrides?.artifactMirror ?? {
    async enqueue(requestId: string) {
      // Lazy import breaks the static cycle (the job imports createSigningContext).
      const { mirrorSignatureArtifactTask } = await import(
        "@/features/signing/jobs/mirror-signed-document.job"
      );
      await mirrorSignatureArtifactTask.trigger({ requestId });
    },
  };

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

  const getSourceUrl =
    overrides?.getSourceUrl ??
    (async (input: { file: string; storageType: any }) =>
      getFile({
        type: input.storageType,
        data: input.file,
        expiresIn: 60 * 60 * 1000,
      }));

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
    fields,
    provider,
    mapEventToStatus,
    storage,
    artifactMirror,
    getDocumentFileBytes,
    getSourceUrl,
    deliverEmail: sendEmail,
    logger,
  };
}
