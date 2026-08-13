import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  requireFileAccess,
  sendAuthorizationError,
} from "@/modules/files/server/authorization";
import { VerificationStatus } from "@prisma/client";

const DismissIssueSchema = z.object({
  issueId: z.string().min(1),
  dismissed: z.boolean(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const fileId = String(req.query.fileId || "");
  const taskId = String(req.query.taskId || "");

  try {
    const { file, userId } = await requireFileAccess(req, res, fileId);

    // Verify task belongs to this Dossier File
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, taskListId: true },
    });

    if (!task || task.taskListId !== file.requirementsTaskListId) {
      return res.status(404).json({ error: "Task not found" });
    }

    // GET: Return latest analysis with issues
    if (req.method === "GET") {
      const analysis = await prisma.documentAnalysis.findFirst({
        where: { taskId },
        include: {
          issues: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json({ analysis });
    }

    // PATCH: Dismiss or undismiss a verification issue
    if (req.method === "PATCH") {
      const parsed = DismissIssueSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          issues: parsed.error.flatten(),
        });
      }

      const { issueId, dismissed } = parsed.data;

      // Verify issue belongs to the task's analysis
      const issue = await prisma.verificationIssue.findUnique({
        where: { id: issueId },
        include: {
          analysis: true,
        },
      });

      if (!issue || issue.analysis.taskId !== taskId) {
        return res.status(404).json({ error: "Verification issue not found" });
      }

      const updatedIssue = await prisma.$transaction(async (tx) => {
        const updated = await tx.verificationIssue.update({
          where: { id: issueId },
          data: {
            dismissed,
            dismissedByUserId: dismissed ? userId : null,
            dismissedAt: dismissed ? new Date() : null,
          },
        });

        // Re-evaluate DocumentAnalysis status if all issues are dismissed
        const allIssues = await tx.verificationIssue.findMany({
          where: { analysisId: issue.analysisId },
        });

        const activeErrors = allIssues.filter((i) => !i.dismissed && i.severity === "ERROR");
        const activeWarnings = allIssues.filter((i) => !i.dismissed && i.severity === "WARNING");

        let nextStatus: VerificationStatus = "VERIFIED";
        if (activeErrors.length > 0) {
          nextStatus = "ISSUE";
        } else if (activeWarnings.length > 0 || issue.analysis.extractedKind === "OTHER" || (issue.analysis.confidenceScore ?? 1.0) < 0.8) {
          nextStatus = "NEEDS_REVIEW";
        }

        await tx.documentAnalysis.update({
          where: { id: issue.analysisId },
          data: { status: nextStatus },
        });

        return updated;
      });

      return res.status(200).json({ success: true, issue: updatedIssue });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error("Error in verification analysis API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
