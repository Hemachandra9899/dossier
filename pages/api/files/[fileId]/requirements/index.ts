import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@/lib/prisma";
import {
  requireFileAccess,
  sendAuthorizationError,
} from "@/modules/files/server/authorization";
import { syncDossierFileStatus } from "@/modules/files/application/sync-file-status";

const CreateRequirementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  category: z.string().trim().max(100).optional(),
  dueDate: z.string().datetime().optional(),
  type: z.enum(["TODO", "UPLOAD", "ACKNOWLEDGE"]).default("UPLOAD"),
  assigneeEmail: z.string().email().optional(),
  uploadFolderId: z.string().optional(),
  expectedKind: z.string().optional(),
  verificationRules: z.record(z.any()).optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const fileId = String(req.query.fileId || "");

  try {
    const { file, userId } = await requireFileAccess(req, res, fileId);

    if (req.method === "POST") {
      const parsed = CreateRequirementSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          issues: parsed.error.flatten(),
        });
      }

      const dossierFile = await prisma.dossierFile.findUnique({
        where: { id: fileId },
        select: {
          requirementsTaskListId: true,
          teamId: true,
          dataroomId: true,
        },
      });

      if (!dossierFile?.requirementsTaskListId) {
        return res.status(409).json({
          error: "File has no requirements list",
        });
      }

      const lastTask = await prisma.task.findFirst({
        where: {
          taskListId: dossierFile.requirementsTaskListId,
        },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });

      const task = await prisma.$transaction(async (tx) => {
        const created = await tx.task.create({
          data: {
            title: parsed.data.title,
            description: parsed.data.description,
            category: parsed.data.category,
            type: parsed.data.type,
            status: "OPEN",
            dueDate: parsed.data.dueDate
              ? new Date(parsed.data.dueDate)
              : null,
            orderIndex: (lastTask?.orderIndex ?? -1) + 1,

            taskListId: dossierFile.requirementsTaskListId!,
            dataroomId: dossierFile.dataroomId,
            teamId: dossierFile.teamId,
            createdByUserId: userId,
            uploadFolderId: parsed.data.uploadFolderId ?? null,

            assignments: parsed.data.assigneeEmail
              ? {
                  create: {
                    email: parsed.data.assigneeEmail,
                  },
                }
              : undefined,

            activities: {
              create: {
                type: "CREATED",
                userId,
              },
            },
          },
        });

        if (parsed.data.expectedKind) {
          await tx.dossierRequirementPolicy.create({
            data: {
              taskId: created.id,
              expectedKind: parsed.data.expectedKind,
              verificationRules: parsed.data.verificationRules || {},
            },
          });
        }

        await tx.dossierFileActivity.create({
          data: {
            fileId,
            type: "REQUIREMENT_CREATED",
            actorUserId: userId,
            metadata: {
              taskId: created.id,
              title: created.title,
            },
          },
        });

        return created;
      });

      await syncDossierFileStatus(fileId, {
        actorUserId: userId,
      });

      return res.status(201).json({ task });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
