import { DossierFilePriority } from "@prisma/client";
import { nanoid } from "nanoid";

import prisma from "@/lib/prisma";

type CreateFileInput = {
  teamId: string;
  userId: string;
  title: string;
  clientName?: string | null;
  clientEmail?: string | null;
  reference?: string | null;
  caseType?: string | null;
  priority?: DossierFilePriority;
  ownerId?: string | null;
  dueAt?: Date | null;
  requiresSignature?: boolean;
};

export async function createDossierFile(input: CreateFileInput) {
  if (input.ownerId) {
    const ownerMembership = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId: input.ownerId,
          teamId: input.teamId,
        },
      },
    });

    if (!ownerMembership || ownerMembership.status !== "ACTIVE") {
      throw new Error("Selected owner is not an active team member.");
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const dataroom = await tx.dataroom.create({
      data: {
        pId: `dr_${nanoid(12)}`,
        name: input.title,
        internalName: input.clientName
          ? `${input.clientName} — ${input.title}`
          : input.title,
        teamId: input.teamId,
        requestListEnabled: true,
        defaultShowBanner: false,
      },
    });

    const requirementList = await tx.taskList.create({
      data: {
        name: "Required Documents",
        orderIndex: 0,
        dataroomId: dataroom.id,
        teamId: input.teamId,
      },
    });

    const lastFile = await tx.dossierFile.findFirst({
      where: {
        teamId: input.teamId,
        status: "NEW",
      },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const file = await tx.dossierFile.create({
      data: {
        teamId: input.teamId,
        dataroomId: dataroom.id,
        requirementsTaskListId: requirementList.id,

        title: input.title,
        clientName: input.clientName ?? null,
        clientEmail: input.clientEmail ?? null,
        reference: input.reference ?? null,
        caseType: input.caseType ?? null,

        priority: input.priority ?? "NORMAL",
        ownerId: input.ownerId ?? input.userId,
        dueAt: input.dueAt ?? null,
        requiresSignature: input.requiresSignature ?? false,
        position: (lastFile?.position ?? 0) + 1000,
      },
    });

    await tx.dossierFileActivity.create({
      data: {
        fileId: file.id,
        type: "FILE_CREATED",
        actorUserId: input.userId,
        metadata: {
          dataroomId: dataroom.id,
        },
      },
    });

    return file;
  });

  return result;
}
