import type {
  DossierCompletionArtifactKind,
  DossierCompletionRunStatus,
  DocumentStorageType,
} from "@prisma/client";

/**
 * Version of the completion snapshot/manifest schema. Bumped whenever the
 * snapshot shape changes; records persist the version they were produced with.
 */
export const COMPLETION_SCHEMA_VERSION = 1;

/**
 * Serialized representation of a DossierCompletionRun. All dates are ISO
 * strings so the DTO is safe to return over HTTP without leaking any storage
 * keys or snapshot payloads.
 */
export type CompletionRunDTO = {
  id: string;
  fileId: string;
  initiatedById: string;
  status: DossierCompletionRunStatus;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  record: CompletionRecordSummaryDTO | null;
};

/** Lightweight, storage-free view of a DossierCompletionRecord. */
export type CompletionRecordSummaryDTO = {
  id: string;
  version: number;
  schemaVersion: number;
  manifestHash: string;
  completedById: string;
  completedAt: string;
  createdAt: string;
};

/** Artifact exposed to API consumers. storageKey is intentionally omitted. */
export type CompletionArtifactDTO = {
  id: string;
  kind: DossierCompletionArtifactKind;
  sourceDocumentId: string | null;
  sourceDocumentVersionId: string | null;
  sourceSignatureArtifactId: string | null;
  fileName: string;
  mimeType: string | null;
  sizeBytes: string;
  sha256: string;
  storageType: DocumentStorageType;
  createdAt: string;
};

/** Full record detail: summary fields plus snapshot and artifacts. */
export type CompletionRecordDetailDTO = CompletionRecordSummaryDTO & {
  snapshot: unknown;
  artifacts: CompletionArtifactDTO[];
};
