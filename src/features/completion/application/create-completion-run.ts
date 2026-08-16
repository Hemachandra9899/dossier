import prisma from "@/platform/db";

import { getCompletionReadiness } from "./get-completion-readiness";
import { CompletionDomainError } from "../domain/errors";

export async function createCompletionRun(input: {
  dossierFileId?: string;
  fileId?: string;
  actorUserId?: string;
  initiatedById?: string;
}) {
  const fileId = input.dossierFileId || input.fileId;
  if (!fileId) throw new Error("File ID required");

  const file = await prisma.dossierFile.findUnique({
    where: { id: fileId },
    select: { id: true, status: true },
  });
  if (!file) {
    throw new CompletionDomainError("File not found", "FILE_NOT_FOUND");
  }

  if (file.status !== "READY_TO_CLOSE") {
    throw new CompletionDomainError(
      "File is not ready to close",
      "FILE_NOT_READY_TO_CLOSE",
    );
  }

  const readiness = await getCompletionReadiness(fileId);
  if (!readiness.ready) {
    throw new CompletionDomainError(
      "File has completion blockers",
      "FILE_HAS_COMPLETION_BLOCKERS",
      readiness.blockers,
    );
  }

  const idempotencyKey = `completion:${fileId}:v1`;

  const existing = await prisma.dossierCompletionRun.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return existing;
  }

  const initiatedById = input.actorUserId || input.initiatedById;
  if (!initiatedById) throw new Error("Initiator user ID required");

  try {
    return await prisma.dossierCompletionRun.create({
      data: {
        dossierFileId: fileId,
        initiatedById,
        idempotencyKey,
        status: "PENDING",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const winner = await prisma.dossierCompletionRun.findUniqueOrThrow({
        where: { idempotencyKey },
      });
      return winner;
    }
    throw error;
  }
}
