import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import {
  requireFileAccess,
  sendAuthorizationError,
} from "@/modules/files/server/authorization";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const fileId = String(req.query.fileId || "");
  const taskId = String(req.query.taskId || "");

  try {
    const { file } = await requireFileAccess(req, res, fileId);

    // Verify task belongs to this Dossier File
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, taskListId: true },
    });

    if (!task || task.taskListId !== file.requirementsTaskListId) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Find the latest upload for this task
    const latestUpload = await prisma.documentUpload.findFirst({
      where: { taskId },
      orderBy: { uploadedAt: "desc" },
      include: {
        document: {
          include: {
            versions: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!latestUpload || !latestUpload.document.versions[0]) {
      return res.status(400).json({ error: "No document has been uploaded for this requirement yet." });
    }

    const { dossierDocumentAnalysisTask } = await import(
      "@/lib/trigger/dossier-document-analysis"
    );

    const run = await dossierDocumentAnalysisTask.trigger({
      documentId: latestUpload.documentId,
      documentVersionId: latestUpload.document.versions[0].id,
      taskId,
      linkId: latestUpload.linkId,
    });

    return res.status(200).json({ success: true, runId: run.id });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error("Error in reanalyze requirement API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
