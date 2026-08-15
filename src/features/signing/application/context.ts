import { DocumentRepository } from "../server/document.repository";
import { ProviderEventRepository } from "../server/provider-event.repository";
import { SignatureRequestRepository } from "../server/signature-request.repository";
import { SignatureTemplateRepository } from "../server/signature-template.repository";
import { documensoSigningProvider } from "../providers/documenso/provider";
import { mapDocumensoEventToStatus } from "../providers/documenso/mapper";
import type { SigningProvider } from "../providers/signing-provider";
import { s3Storage } from "@/infrastructure/storage";
import { signedArtifactStorage, SignedArtifactStorage } from "@/infrastructure/storage/signed-artifact-storage";

export type ProviderEventMapper = (event: string) => any;

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
      const buffer = await s3Storage.getBuffer(input.file);
      if (!buffer) {
        throw new Error(`File buffer not found in storage for key ${input.file}`);
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
    artifactMirror: null,
    getDocumentFileBytes,
    logger,
  };
}
