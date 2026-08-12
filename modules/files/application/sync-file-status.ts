import prisma from "@/lib/prisma";
import { deriveFileStatus } from "../domain/file-status";

export async function syncDossierFileStatus(
  fileId: string,
  context?: {
    actorUserId?: string | null;
    dedupeKey?: string | null;
  },
) {
  const file = await prisma.dossierFile.findUnique({
    where: { id: fileId },
    include: {
      requirementsTaskList: {
        include: {
          tasks: {
            include: {
              assignments: true,
            },
          },
        },
      },
      signatureRequests: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!file) return null;

  const nextStatus = deriveFileStatus({
    currentStatus: file.status,
    requiresSignature: file.requiresSignature,
    requirements:
      file.requirementsTaskList?.tasks.map((task) => ({
        status: task.status,
        hasExternalAssignment: task.assignments.some(
          (assignment) =>
            !!assignment.viewerId ||
            !!assignment.groupId ||
            !!assignment.linkId ||
            !!assignment.email,
        ),
      })) ?? [],
    signatures: file.signatureRequests.map((request) => ({
      status: request.status,
    })),
  });

  if (nextStatus === file.status) {
    return file;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.dossierFile.update({
      where: { id: fileId },
      data: {
        status: nextStatus,
        completedAt:
          nextStatus === "COMPLETE"
            ? file.completedAt ?? new Date()
            : null,
      },
    });

    await tx.dossierFileActivity.create({
      data: {
        fileId,
        type:
          nextStatus === "COMPLETE"
            ? "FILE_COMPLETED"
            : "STATUS_CHANGED",
        actorUserId: context?.actorUserId ?? null,
        dedupeKey: context?.dedupeKey ?? null,
        metadata: {
          from: file.status,
          to: nextStatus,
        },
      },
    });

    return updated;
  });
}
