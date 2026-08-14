// Application composition root: builds a SigningContext by wiring Prisma-backed
// repositories, the Documenso provider, artifact storage and the durable
// artifact-mirror handoff into the interfaces that use-cases depend on.
// Use-cases never construct their own dependencies; tests and jobs call
// createSigningContext({ prisma, ... }) to swap in fakes.

import type { PrismaClient } from "@prisma/client";
import { DocumentStorageType } from "@prisma/client";

import { getFile } from "@/lib/files/get-file";
import prisma from "@/lib/prisma";

import type { SignatureRequestStatus } from "../domain/signature-request";
import { SigningProviderError } from "../domain/signing-errors";
import type { SigningLogger } from "../logging";
import { consoleSigningLogger } from "../logging";
import type { SigningProvider } from "../provider/signing-provider";
import { documensoSigningProvider } from "../provider/documenso/provider";
import { getDocumensoHost } from "../provider/documenso/client";
import { mapDocumensoEventToStatus } from "../provider/documenso/mapper";
import { DocumentRepository } from "../server/document.repository";
import { ProviderEventRepository } from "../server/provider-event.repository";
import { SignatureRequestRepository } from "../server/signature-request.repository";
import { SignatureTemplateRepository } from "../server/signature-template.repository";
import type { SignedArtifactStorage } from "../storage/signed-artifact-storage";
import { s3SignedArtifactStorage } from "../storage/s3-signed-artifact-storage";

export type ProviderEventMapper = (
  event: string,
) => SignatureRequestStatus | null;

export interface ArtifactMirrorHandoff {
  enqueue(requestId: string): Promise<void>;
}

/** Stored-document file resolution, injectable so tests never touch storage. */
export type DocumentFileFetcher = (input: {
  file: string;
  storageType: string;
}) => Promise<Uint8Array>;

const MAX_DOCUMENT_FILE_BYTES = 50 * 1024 * 1024;

const defaultDocumentFileFetcher: DocumentFileFetcher = async (input) => {
  const url = await getFile({
    type: input.storageType as DocumentStorageType,
    data: input.file,
    expiresIn: 30_000,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new SigningProviderError(
      `Failed to retrieve the document file (status ${response.status}).`,
    );
  }

  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength === 0) {
    throw new SigningProviderError("The document file is empty.");
  }
  if (body.byteLength > MAX_DOCUMENT_FILE_BYTES) {
    throw new SigningProviderError("The document file is too large to sign.");
  }

  return new Uint8Array(body);
};

export interface SigningContext {
  documents: DocumentRepository;
  templates: SignatureTemplateRepository;
  requests: SignatureRequestRepository;
  events: ProviderEventRepository;

  provider: SigningProvider;
  storage: SignedArtifactStorage;
  getDocumentFileBytes: DocumentFileFetcher;

  /** Durable handoff for mirroring signed artifacts (Trigger.dev task). */
  artifactMirror: ArtifactMirrorHandoff;

  /** Normalizes a raw provider event name into the Dossier status vocabulary. */
  mapEventToStatus: ProviderEventMapper;

  /** Resolves the host the editor/signing session embeds on. */
  getSigningHost: () => string;

  logger: SigningLogger;
}

export function createSigningContext(
  overrides: Partial<SigningContext> & { prisma?: PrismaClient } = {},
): SigningContext {
  const db = overrides.prisma ?? prisma;

  return {
    documents: new DocumentRepository(db),
    templates: new SignatureTemplateRepository(db),
    requests: new SignatureRequestRepository(db),
    events: new ProviderEventRepository(db),
    provider: documensoSigningProvider,
    storage: s3SignedArtifactStorage,
    getDocumentFileBytes: defaultDocumentFileFetcher,
    artifactMirror: {
      // Dynamic import breaks the static cycle (the trigger task imports this
      // composition root to build its own context).
      enqueue: async (requestId: string) => {
        const { mirrorSignatureArtifactTask } = await import(
          "@/lib/trigger/signature-artifact-mirror"
        );
        await mirrorSignatureArtifactTask.trigger({ requestId });
      },
    },
    mapEventToStatus: mapDocumensoEventToStatus,
    getSigningHost: getDocumensoHost,
    logger: consoleSigningLogger,
    ...overrides,
  };
}
