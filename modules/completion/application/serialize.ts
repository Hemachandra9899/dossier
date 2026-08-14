import type {
  DossierCompletionArtifact,
  DossierCompletionRecord,
  DossierCompletionRun,
  DossierCompletionRunStatus,
} from "@prisma/client";

import type {
  CompletionArtifactDTO,
  CompletionRecordDetailDTO,
  CompletionRecordSummaryDTO,
  CompletionRunDTO,
} from "../domain/completion";

type CompletionRunView = {
  id: string;
  dossierFileId: string;
  initiatedById: string;
  status: DossierCompletionRunStatus;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  record: DossierCompletionRecord | null;
};

export function toCompletionRunDTO(
  run: DossierCompletionRun & { record: DossierCompletionRecord | null },
): CompletionRunDTO;
export function toCompletionRunDTO(run: CompletionRunView): CompletionRunDTO;
export function toCompletionRunDTO(
  run:
    | (DossierCompletionRun & {
        record: DossierCompletionRecord | null;
      })
    | CompletionRunView,
): CompletionRunDTO {
  return {
    id: run.id,
    fileId: run.dossierFileId,
    initiatedById: run.initiatedById,
    status: run.status,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    record: run.record ? toCompletionRecordSummaryDTO(run.record) : null,
  };
}

export function toCompletionRecordSummaryDTO(
  record: DossierCompletionRecord,
): CompletionRecordSummaryDTO {
  return {
    id: record.id,
    version: record.version,
    schemaVersion: record.schemaVersion,
    manifestHash: record.manifestHash,
    completedById: record.completedById,
    completedAt: record.completedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

export function toCompletionRecordDetailDTO(
  record: DossierCompletionRecord & {
    artifacts: DossierCompletionArtifact[];
  },
): CompletionRecordDetailDTO {
  return {
    ...toCompletionRecordSummaryDTO(record),
    snapshot: record.snapshot,
    artifacts: record.artifacts.map(toCompletionArtifactDTO),
  };
}

export function toCompletionArtifactDTO(
  artifact: DossierCompletionArtifact,
): CompletionArtifactDTO {
  return {
    id: artifact.id,
    kind: artifact.kind,
    sourceDocumentId: artifact.sourceDocumentId,
    sourceDocumentVersionId: artifact.sourceDocumentVersionId,
    sourceSignatureArtifactId: artifact.sourceSignatureArtifactId,
    fileName: artifact.fileName,
    mimeType: artifact.mimeType,
    sizeBytes: artifact.sizeBytes.toString(),
    sha256: artifact.sha256,
    storageType: artifact.storageType,
    createdAt: artifact.createdAt.toISOString(),
  };
}
