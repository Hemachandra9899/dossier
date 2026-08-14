import { logger, task } from "@trigger.dev/sdk";
import prisma from "@/infrastructure/database/prisma";
import { getFile } from "@/lib/files/get-file";
import { dossierDocumentAnalysisQueue } from "@/lib/trigger/queues";
import { extractDocumentFacts } from "../providers/openai.provider";
import { evaluateVerificationChecks } from "../verification.rules";
import { DocumentKind } from "../verification.types";

export interface DossierDocumentAnalysisPayload {
  analysisId: string;
}

export const dossierDocumentAnalysisTask = task({
  id: "dossier-document-analysis",
  retry: { maxAttempts: 3 },
  queue: dossierDocumentAnalysisQueue,
  run: async (payload: DossierDocumentAnalysisPayload) => {
    const { analysisId } = payload;

    logger.info("dossier.verification.started", { analysisId });

    // 1. Fetch the analysis record and relations
    const analysisRecord = await prisma.documentAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        task: {
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
        },
        documentVersion: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!analysisRecord) {
      logger.error("dossier.verification.not_found", { analysisId });
      return { success: false, reason: "Analysis record not found" };
    }

    const { taskId, documentVersionId } = analysisRecord;
    const taskRecord = analysisRecord.task;
    const policy = taskRecord.policy;
    const documentVersion = analysisRecord.documentVersion;

    if (!policy) {
      logger.info("dossier.verification.no_policy", { taskId, analysisId });
      await prisma.documentAnalysis.update({
        where: { id: analysisId },
        data: {
          runStatus: "FAILED",
          status: "NEEDS_REVIEW",
        },
      });
      return { success: false, reason: "No verification policy defined for task" };
    }

    // 2. Mark run status as PROCESSING
    await prisma.documentAnalysis.update({
      where: { id: analysisId },
      data: {
        runStatus: "PROCESSING",
      },
    });

    // 3. Fetch the document content buffer from S3/Vercel Blob
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
    } catch (fetchErr: any) {
      logger.error("dossier.verification.fetch_failed", { fetchErr, documentVersionId, analysisId });
      await prisma.documentAnalysis.update({
        where: { id: analysisId },
        data: {
          runStatus: "FAILED",
          status: "NEEDS_REVIEW",
        },
      });
      await prisma.verificationIssue.create({
        data: {
          analysisId,
          checkCode: "AI_ANALYSIS_FAILED",
          severity: "WARNING",
          message: `Failed to retrieve document file content: ${fetchErr?.message || fetchErr}. Please verify manually.`,
          evidence: "File fetch failed",
        },
      });
      return { success: false, reason: "Failed to retrieve document file" };
    }

    // 4. Extract facts using OpenAI or Mock fallback
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

      logger.info("dossier.verification.extracted", {
        analysisId,
        taskId,
        documentVersionId,
        detectedKind: extracted.detectedKind,
        confidenceScore: extracted.confidenceScore,
      });

      // Run rules engine & evaluate checks
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
      logger.error("dossier.verification.extraction_failed", { extractErr, analysisId });
      isAiFailure = true;
      failureMessage = extractErr?.message || "Fact extraction failed";
    }

    // 5. Persist DocumentAnalysis status and issues
    logger.info("dossier.verification.completed", {
      analysisId,
      status,
      failedCheckCount: checks.filter((check) => !check.pass).length,
    });

    await prisma.$transaction(async (tx) => {
      await tx.documentAnalysis.update({
        where: { id: analysisId },
        data: {
          runStatus: isAiFailure ? "FAILED" : "COMPLETED",
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
            analysisId: analysisId,
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
                analysisId: analysisId,
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

    return { success: !isAiFailure, status };
  },
});
