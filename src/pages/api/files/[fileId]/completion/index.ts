import type { NextApiRequest, NextApiResponse } from "next";

import {
  requireFileAccess,
  requireFileManageAccess,
  sendAuthorizationError,
} from "@/modules/files/server/authorization";
import { createCompletionRun } from "@/modules/completion/application/create-completion-run";
import {
  toCompletionRecordSummaryDTO,
  toCompletionRunDTO,
} from "@/modules/completion/application/serialize";
import { CompletionDomainError } from "@/modules/completion/domain/errors";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const fileId = String(req.query.fileId || "");

  try {
    if (req.method === "POST") {
      const { userId } = await requireFileManageAccess(req, res, fileId);
      const run = await createCompletionRun({
        fileId,
        initiatedById: userId,
      });
      return res.status(202).json({ run });
    }

    if (req.method === "GET") {
      await requireFileAccess(req, res, fileId);

      const [latestRun, latestRecord] = await Promise.all([
        prisma.dossierCompletionRun.findFirst({
          where: { dossierFileId: fileId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            dossierFileId: true,
            initiatedById: true,
            status: true,
            errorCode: true,
            errorMessage: true,
            startedAt: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
            record: true,
          },
        }),
        prisma.dossierCompletionRecord.findFirst({
          where: { dossierFileId: fileId },
          orderBy: { version: "desc" },
        }),
      ]);

      return res.status(200).json({
        latestRun: latestRun ? toCompletionRunDTO(latestRun) : null,
        latestRecord: latestRecord
          ? toCompletionRecordSummaryDTO(latestRecord)
          : null,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;

    if (error instanceof CompletionDomainError) {
      if (error.code === "FILE_NOT_FOUND") {
        return res.status(404).json({ error: "File not found" });
      }
      if (error.code === "FILE_HAS_COMPLETION_BLOCKERS") {
        return res.status(409).json({
          code: error.code,
          blockers: error.blockers,
        });
      }
      return res.status(409).json({ code: error.code });
    }

    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
