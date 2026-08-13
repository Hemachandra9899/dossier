import { logger, task } from "@trigger.dev/sdk";
import prisma from "@/lib/prisma";
import { getFile } from "@/lib/files/get-file";
import { dossierDocumentAnalysisQueue } from "./queues";
import { extractDocumentFacts } from "@/lib/verification/openai-provider";
import { evaluateVerificationChecks } from "@/lib/verification/evaluate-checks";
import { DocumentKind } from "@/lib/verification/extraction-schema";

export interface DossierDocumentAnalysisPayload {
  documentId: string;
  documentVersionId: string;
  taskId: string;
  linkId: string;
}

export const dossierDocumentAnalysisTask = task({
  id: "dossier-document-analysis",
  retry: { maxAttempts: 3 },
  queue: dossierDocumentAnalysisQueue,
  run: async (payload: DossierDocumentAnalysisPayload) => {
    const { documentId, documentVersionId, taskId, linkId } = payload;

    logger.info("Starting dossier document verification analysis", {
      documentId,
      documentVersionId,
      taskId,
      linkId,
    });

    // 1. Fetch task, requirement policy, document version and dossier file
    const taskRecord = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        policy: true,
        taskList: {
          select: {
            dossierFileRequirements: {
              select: {
                id: true,
                clientName: true,
              },
            },
          },
        },
      },
    });

    if (!taskRecord) {
      logger.error("Task not found for verification, aborting", { taskId });
      return { success: false, reason: "Task not found" };
    }

    const policy = taskRecord.policy;
    if (!policy) {
      logger.info("No verification policy defined for task, skipping analysis", { taskId });
      return { success: true, reason: "No policy defined" };
    }

    const documentVersion = await prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
      include: {
        document: true,
      },
    });

    if (!documentVersion) {
      logger.error("Document version not found, aborting", { documentVersionId });
      return { success: false, reason: "Document version not found" };
    }

    // 2. Fetch the document content buffer from Vercel Blob/S3
    let fileBuffer: Buffer;
    try {
      const fileUrl = await getFile({
        type: documentVersion.storageType,
        data: documentVersion.file,
        isDownload: true,
      });

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
      }
      fileBuffer = Buffer.from(await response.arrayBuffer());
    } catch (fetchErr) {
      logger.error("Failed to retrieve document file content", { fetchErr, documentVersionId });
      return { success: false, reason: "Failed to retrieve document file" };
    }

    // 3. Extract facts using OpenAI or Mock fallback
    logger.info("Extracting document facts", {
      fileName: documentVersion.document.name,
      expectedKind: policy.expectedKind,
    });

    let extracted = null;
    let status: any = "NEEDS_REVIEW";
    let checks: any[] = [];
    let isAiFailure = false;
    let failureMessage = "";

    try {
      extracted = await extractDocumentFacts({
        fileBuffer,
        fileName: documentVersion.document.name,
        mimeType: documentVersion.contentType || "application/octet-stream",
        expectedKind: policy.expectedKind as DocumentKind,
      });

      // 4. Run rules engine & evaluate checks
      logger.info("Evaluating verification checks", { extracted });
      const clientName = taskRecord.taskList.dossierFileRequirements?.clientName;

      const evaluation = await evaluateVerificationChecks({
        taskId,
        extracted,
        policyExpectedKind: policy.expectedKind,
        policyRules: policy.verificationRules as any,
        clientName,
      });
      status = evaluation.status;
      checks = evaluation.checks;
    } catch (extractErr: any) {
      logger.error("Document analysis extraction failed", { extractErr });
      isAiFailure = true;
      failureMessage = extractErr?.message || "Fact extraction failed";
    }

    // 5. Persist DocumentAnalysis and issues
    logger.info("Saving document analysis results", { status, checks });
    await prisma.$transaction(async (tx) => {
      // Defer/archive any previous analysis by deleting it (or keeping it, we choose to keep but the latest wins)
      const analysis = await tx.documentAnalysis.create({
        data: {
          documentVersionId,
          taskId,
          status,
          extractedKind: extracted ? extracted.detectedKind : null,
          extractedData: extracted ? (extracted as any) : null,
          checks: checks as any,
          confidenceScore: extracted ? extracted.confidenceScore : null,
        },
      });

      if (isAiFailure) {
        await tx.verificationIssue.create({
          data: {
            analysisId: analysis.id,
            checkCode: "AI_ANALYSIS_FAILED",
            severity: "WARNING",
            message: `Automated document analysis failed: ${failureMessage}. Please verify manually.`,
            evidence: "Extraction failed",
          },
        });
      } else {
        // Save issues for failed checks
        for (const check of checks) {
          if (!check.pass) {
            await tx.verificationIssue.create({
              data: {
                analysisId: analysis.id,
                checkCode: check.code,
                severity: check.severity,
                message: check.message,
                evidence: check.evidence || null,
              },
            });
          }
        }
      }
    });

    logger.info("Dossier document verification completed successfully", { status });
    return { success: !isAiFailure, status };
  },
});
