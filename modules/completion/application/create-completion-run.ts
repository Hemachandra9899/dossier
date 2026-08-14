import {
  DossierCompletionRunStatus,
  Prisma,
} from "@prisma/client";

import prisma from "@/lib/prisma";

import type { CompletionRunDTO } from "../domain/completion";
import { CompletionDomainError } from "../domain/errors";
import { getCompletionReadiness } from "./get-completion-readiness";
import { toCompletionRunDTO } from "./serialize";

type CreateCompletionRunInput = {
  fileId: string;
  initiatedById: string;
};

const ACTIVE_RUN_STATUSES = [
  DossierCompletionRunStatus.PENDING,
  DossierCompletionRunStatus.PROCESSING,
];

const RUN_SELECT = {
  id: true,
  dossierFileId: true,
  initiatedById: true,
  idempotencyKey: true,
  status: true,
  errorCode: true,
  errorMessage: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  record: true,
} as const;

/**
 * Starts a completion run for a dossier file. Idempotent and concurrency-safe:
 *
 *  - The file must be in READY_TO_CLOSE status AND pass the completion
 *    readiness gate (safety rule: both conditions, never readiness alone).
 *  - An existing active run (PENDING/PROCESSING) is returned instead of
 *    creating a duplicate.
 *  - The idempotency key embeds the *next record version*
 *    (completion:<fileId>:v<nextVersion>) where nextVersion is derived from
 *    the latest DossierCompletionRecord. Versions belong to records, not runs,
 *    so failed/retried runs do not consume a version.
 *  - The unique idempotencyKey index guarantees at most one run is created,
 *    even when two requests race with the same computed version.
 *
 * CP10.2 only creates PENDING runs; the finalization worker drives the rest.
 */
export async function createCompletionRun(
  input: CreateCompletionRunInput,
): Promise<CompletionRunDTO> {
  const file = await prisma.dossierFile.findUnique({
    where: { id: input.fileId },
    select: { id: true, status: true },
  });

  if (!file) {
    throw new CompletionDomainError("FILE_NOT_FOUND", "File not found");
  }

  if (file.status !== "READY_TO_CLOSE") {
    throw new CompletionDomainError(
      "FILE_NOT_READY_TO_CLOSE",
      `File must be in READY_TO_CLOSE status before completion can start (current status: ${file.status}).`,
    );
  }

  const readiness = await getCompletionReadiness(input.fileId);

  if (!readiness.ready) {
    throw new CompletionDomainError(
      "FILE_HAS_COMPLETION_BLOCKERS",
      "File has unresolved completion blockers.",
      readiness.blockers,
    );
  }

  const activeRun = await prisma.dossierCompletionRun.findFirst({
    where: {
      dossierFileId: input.fileId,
      status: { in: ACTIVE_RUN_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    select: RUN_SELECT,
  });

  if (activeRun) {
    return toCompletionRunDTO(activeRun);
  }

  const latestRecord = await prisma.dossierCompletionRecord.findFirst({
    where: { dossierFileId: input.fileId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (latestRecord?.version ?? 0) + 1;
  const idempotencyKey = `completion:${input.fileId}:v${nextVersion}`;

  try {
    const run = await prisma.dossierCompletionRun.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        dossierFileId: input.fileId,
        initiatedById: input.initiatedById,
        idempotencyKey,
        status: DossierCompletionRunStatus.PENDING,
      },
      select: RUN_SELECT,
    });

    return toCompletionRunDTO(run);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // A concurrent request created the run for this version first.
      const existing = await prisma.dossierCompletionRun.findUnique({
        where: { idempotencyKey },
        select: RUN_SELECT,
      });
      if (existing) {
        return toCompletionRunDTO(existing);
      }
    }
    throw error;
  }
}
