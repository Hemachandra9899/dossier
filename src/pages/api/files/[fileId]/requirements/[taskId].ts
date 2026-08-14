import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@/lib/prisma";
import {
  requireFileAccess,
  sendAuthorizationError,
} from "@/modules/files/server/authorization";
import { syncDossierFileStatus } from "@/modules/files/application/sync-file-status";
import { DossierFileStatus } from "@prisma/client";

const UpdateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "SUBMITTED", "COMPLETED"]),
  comment: z.string().trim().max(1000).optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const fileId = String(req.query.fileId || "");
  const taskId = String(req.query.taskId || "");

  try {
    const { file, userId } = await requireFileAccess(req, res, fileId);

    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        issues: parsed.error.flatten(),
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || task.taskListId !== file.requirementsTaskListId) {
      return res.status(404).json({ error: "Task not found" });
    }

    const nextStatus = parsed.data.status;
    const comment = parsed.data.comment;

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: nextStatus,
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId,
          type: "STATUS_CHANGED",
          fromStatus: task.status,
          toStatus: nextStatus,
          userId,
          comment: comment || null,
        },
      });

      if (comment) {
        await tx.dossierFileActivity.create({
          data: {
            fileId,
            type: "CORRECTION_REQUESTED",
            actorUserId: userId,
            metadata: {
              taskId,
              taskTitle: task.title,
              comment,
            },
          },
        });
      } else {
        await tx.dossierFileActivity.create({
          data: {
            fileId,
            type: "REQUIREMENT_COMPLETED",
            actorUserId: userId,
            metadata: {
              taskId,
              taskTitle: task.title,
              status: nextStatus,
            },
          },
        });
      }

      // If rejecting a submission, set DossierFile status to NEEDS_CORRECTION
      if (nextStatus === "OPEN" && task.status === "SUBMITTED") {
        await tx.dossierFile.update({
          where: { id: fileId },
          data: {
            status: DossierFileStatus.NEEDS_CORRECTION,
          },
        });
      }
    });

    await syncDossierFileStatus(fileId, {
      actorUserId: userId,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
