import { DossierFilePriority } from "@prisma/client";
import { nanoid } from "nanoid";

import prisma from "@/platform/db";

type CreateFileInput = {
  teamId: string;
  userId: string;
  title: string;
  name?: string;
  clientName?: string | null;
  clientEmail?: string | null;
  reference?: string | null;
  caseType?: string | null;
  priority?: DossierFilePriority;
  ownerId?: string | null;
  dueAt?: Date | null;
  requiresSignature?: boolean;
  templateId?: string | null;
};

export async function createFile(input: any) {
  const teamId = typeof input === "string" ? input : input.teamId;
  const title = typeof input === "string" ? "New File" : input.title || input.name || "New File";

  const normalized: CreateFileInput = {
    teamId,
    userId: typeof input === "object" ? input.userId : undefined,
    title,
    clientName: typeof input === "object" ? input.clientName : undefined,
    clientEmail: typeof input === "object" ? input.clientEmail : undefined,
    reference: typeof input === "object" ? input.reference : undefined,
    caseType: typeof input === "object" ? input.caseType : undefined,
    priority: typeof input === "object" ? input.priority : undefined,
    ownerId: typeof input === "object" ? input.ownerId : undefined,
    dueAt: typeof input === "object" ? input.dueAt : undefined,
    requiresSignature:
      typeof input === "object" ? (input.requiresSignature ?? false) : false,
    templateId: typeof input === "object" ? input.templateId : undefined,
  };

  if (normalized.ownerId) {
    const ownerMembership = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId: normalized.ownerId,
          teamId: normalized.teamId,
        },
      },
    });

    if (!ownerMembership || ownerMembership.status !== "ACTIVE") {
      throw new Error("Selected owner is not an active team member.");
    }
  }

  if (!normalized.userId) {
    throw new Error("userId is required");
  }

  const result = await prisma.$transaction(async (tx) => {
    const dataroom = await tx.dataroom.create({
      data: {
        pId: `dr_${nanoid(12)}`,
        name: normalized.title,
        internalName: normalized.clientName
          ? `${normalized.clientName} — ${normalized.title}`
          : normalized.title,
        teamId: normalized.teamId,
        requestListEnabled: true,
        defaultShowBanner: false,
      },
    });

    const requirementList = await tx.taskList.create({
      data: {
        name: "Required Documents",
        orderIndex: 0,
        dataroomId: dataroom.id,
        teamId: normalized.teamId,
      },
    });

    const lastFile = await tx.dossierFile.findFirst({
      where: {
        teamId: normalized.teamId,
        status: "NEW",
      },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const file = await tx.dossierFile.create({
      data: {
        teamId: normalized.teamId,
        dataroomId: dataroom.id,
        requirementsTaskListId: requirementList.id,

        title: normalized.title,
        clientName: normalized.clientName ?? null,
        clientEmail: normalized.clientEmail ?? null,
        reference: normalized.reference ?? null,
        caseType: normalized.caseType ?? null,

        priority: normalized.priority ?? "NORMAL",
        ownerId: normalized.ownerId ?? normalized.userId,
        dueAt: normalized.dueAt ?? null,
        requiresSignature: normalized.requiresSignature ?? false,
        position: (lastFile?.position ?? 0) + 1000,
      },
    });

    if (normalized.templateId) {
      const template = await tx.dossierFileTemplate.findUnique({
        where: { id: normalized.templateId },
        include: { requirements: true },
      });
      if (template) {
        for (const req of template.requirements) {
          const task = await tx.task.create({
            data: {
              taskListId: requirementList.id,
              dataroomId: dataroom.id,
              teamId: normalized.teamId,
              title: req.title,
              type: req.type as any,
              description: req.description,
              status: "OPEN",
              createdByUserId: normalized.userId,
            },
          });

          if (req.expectedKind) {
            await tx.dossierRequirementPolicy.create({
              data: {
                taskId: task.id,
                expectedKind: req.expectedKind,
                verificationRules: req.verificationRules || {},
              },
            });
          }

          if (normalized.clientEmail) {
            await tx.taskAssignment.create({
              data: {
                taskId: task.id,
                email: normalized.clientEmail.trim().toLowerCase(),
              },
            });
          }
        }
      }
    }

    await tx.dossierFileActivity.create({
      data: {
        fileId: file.id,
        type: "FILE_CREATED",
        actorUserId: normalized.userId,
        metadata: {
          dataroomId: dataroom.id,
        },
      },
    });

    return file;
  });

  const { syncDossierFileStatus } = await import("./sync-file-status");
  await syncDossierFileStatus(result.id, { actorUserId: normalized.userId });

  const refreshed = await prisma.dossierFile.findUnique({
    where: { id: result.id },
  });

  return refreshed ?? result;
}

export const createDossierFile = createFile;
