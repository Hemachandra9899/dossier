import {
  DocumentAnalysisRunStatus,
  SignatureRequestStatus,
  VerificationStatus,
} from "@prisma/client";

import prisma from "@/lib/prisma";

import type {
  CompletionBlocker,
  CompletionBlockerCode,
  CompletionReadiness,
} from "../domain/types";

const IGNORED_TERMINAL_SIGNATURE_STATUSES = new Set<SignatureRequestStatus>([
  SignatureRequestStatus.CANCELLED,
  SignatureRequestStatus.FAILED,
  SignatureRequestStatus.DECLINED,
  SignatureRequestStatus.EXPIRED,
]);

export class CompletionReadinessFileNotFoundError extends Error {
  constructor() {
    super("File not found");
  }
}

export async function getCompletionReadiness(
  fileId: string,
): Promise<CompletionReadiness> {
  const file = await prisma.dossierFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      requiresSignature: true,
      requirementsTaskList: {
        select: {
          tasks: {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              policy: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!file) {
    throw new CompletionReadinessFileNotFoundError();
  }

  const tasks = file.requirementsTaskList?.tasks ?? [];
  const taskIds = tasks.map((task) => task.id);

  const blockers: CompletionBlocker[] = [];
  const verificationRequiredTaskIds = new Set<string>();

  const requirementsCompleted = tasks.filter(
    (task) => task.status === "COMPLETED",
  );

  // ---------------------------------------------------------------------------
  // Load authoritative underlying state in a fixed number of batched queries.
  // ---------------------------------------------------------------------------

  const [uploads, signatureRequests] = await Promise.all([
    taskIds.length > 0
      ? prisma.documentUpload.findMany({
          where: { taskId: { in: taskIds } },
          orderBy: { uploadedAt: "desc" },
          select: {
            id: true,
            taskId: true,
            documentId: true,
            uploadedAt: true,
          },
        })
      : Promise.resolve([]),
    prisma.signatureRequest.findMany({
      where: { dossierFileId: fileId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        recipients: { select: { id: true, status: true } },
        artifact: { select: { id: true, sha256: true } },
      },
    }),
  ]);

  // Latest upload per task (uploads are already ordered uploadedAt desc).
  const latestUploadByTask = new Map<string, (typeof uploads)[number]>();
  for (const upload of uploads) {
    if (!upload.taskId) continue;
    if (!latestUploadByTask.has(upload.taskId)) {
      latestUploadByTask.set(upload.taskId, upload);
    }
  }

  const uploadDocumentIds = Array.from(
    new Set(latestUploadByTask.values().map((upload) => upload.documentId)),
  );

  const versions = uploadDocumentIds.length
    ? await prisma.documentVersion.findMany({
        where: { documentId: { in: uploadDocumentIds } },
        select: {
          id: true,
          documentId: true,
          versionNumber: true,
          isPrimary: true,
          createdAt: true,
        },
      })
    : [];

  // Preferred version per document: the primary version when the repo marks
  // one as the source of truth, otherwise the highest version number.
  const versionByDocument = resolvePreferredVersion(versions);

  const versionIds = Array.from(
    versionByDocument.values().map((version) => version.id),
  );

  const analyses = versionIds.length
    ? await prisma.documentAnalysis.findMany({
        where: {
          taskId: { in: taskIds },
          documentVersionId: { in: versionIds },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          taskId: true,
          documentVersionId: true,
          runStatus: true,
          status: true,
        },
      })
    : [];

  const latestAnalysisByVersionKey = new Map<
    string,
    (typeof analyses)[number]
  >();
  for (const analysis of analyses) {
    const key = analysisVersionKey(
      analysis.taskId,
      analysis.documentVersionId,
    );
    if (!latestAnalysisByVersionKey.has(key)) {
      latestAnalysisByVersionKey.set(key, analysis);
    }
  }

  const analysisIds = Array.from(
    new Set(
      latestAnalysisByVersionKey
        .values()
        .map((analysis) => analysis.id),
    ),
  );

  const issues = analysisIds.length
    ? await prisma.verificationIssue.findMany({
        where: { analysisId: { in: analysisIds } },
        select: {
          id: true,
          analysisId: true,
          severity: true,
          dismissed: true,
        },
      })
    : [];

  // ---------------------------------------------------------------------------
  // A. Requirements
  // ---------------------------------------------------------------------------

  for (const task of tasks) {
    if (task.status !== "COMPLETED") {
      blockers.push(
        blocker(
          "REQUIREMENTS_INCOMPLETE",
          `Requirement "${task.title}" is not completed.`,
          { taskId: task.id },
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // B + C. Documents and AI verification (policy-backed UPLOAD tasks only)
  // ---------------------------------------------------------------------------

  let verificationResolved = 0;
  let verificationIssuesOpen = 0;

  for (const task of tasks) {
    const requiresVerification =
      task.type === "UPLOAD" && task.policy !== null;

    if (!requiresVerification) {
      continue;
    }

    if (task.status !== "COMPLETED") {
      continue;
    }

    verificationRequiredTaskIds.add(task.id);

    const upload = latestUploadByTask.get(task.id);
    if (!upload) {
      blockers.push(
        blocker(
          "DOCUMENT_MISSING",
          `No document uploaded for requirement "${task.title}".`,
          { taskId: task.id },
        ),
      );
      continue;
    }

    const version = versionByDocument.get(upload.documentId);
    if (!version) {
      blockers.push(
        blocker(
          "DOCUMENT_VERSION_MISSING",
          `Requirement "${task.title}" has no usable document version.`,
          { taskId: task.id, documentId: upload.documentId },
        ),
      );
      continue;
    }

    const analysis = latestAnalysisByVersionKey.get(
      analysisVersionKey(task.id, version.id),
    );

    if (!analysis) {
      blockers.push(
        blocker(
          "VERIFICATION_MISSING",
          `Requirement "${task.title}" has no verification analysis.`,
          { taskId: task.id, documentId: upload.documentId },
        ),
      );
      continue;
    }

    if (
      analysis.runStatus === DocumentAnalysisRunStatus.PENDING ||
      analysis.runStatus === DocumentAnalysisRunStatus.PROCESSING
    ) {
      blockers.push(
        blocker(
          "VERIFICATION_PENDING",
          `Verification for requirement "${task.title}" is still running.`,
          { taskId: task.id, documentId: upload.documentId },
        ),
      );
      continue;
    }

    if (analysis.runStatus === DocumentAnalysisRunStatus.FAILED) {
      blockers.push(
        blocker(
          "VERIFICATION_FAILED",
          `Verification for requirement "${task.title}" failed.`,
          { taskId: task.id, documentId: upload.documentId },
        ),
      );
      continue;
    }

    const activeIssues = issues.filter(
      (issue) => issue.analysisId === analysis.id && !issue.dismissed,
    );
    verificationIssuesOpen += activeIssues.length;

    const isVerified =
      analysis.status === VerificationStatus.VERIFIED &&
      activeIssues.length === 0;

    if (isVerified) {
      verificationResolved += 1;
    } else {
      blockers.push(
        blocker(
          "VERIFICATION_UNRESOLVED",
          `Requirement "${task.title}" has unresolved verification findings.`,
          { taskId: task.id, documentId: upload.documentId },
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // D. Signing
  // ---------------------------------------------------------------------------

  const signatureRequired = file.requiresSignature;
  let signatureComplete = false;
  let signedArtifactReady = false;

  if (!signatureRequired) {
    signatureComplete = true;
    signedArtifactReady = true;
  } else {
    const relevantRequests = signatureRequests.filter(
      (request) =>
        !IGNORED_TERMINAL_SIGNATURE_STATUSES.has(request.status),
    );

    const completedRequest =
      relevantRequests.find(
        (request) => request.status === SignatureRequestStatus.COMPLETED,
      ) ?? null;

    if (!completedRequest) {
      const code: CompletionBlockerCode =
        signatureRequests.length === 0
          ? "SIGNATURE_REQUIRED_NOT_STARTED"
          : "SIGNATURE_INCOMPLETE";
      blockers.push(
        blocker(
          code,
          code === "SIGNATURE_REQUIRED_NOT_STARTED"
            ? "No signature request has been started for this file."
            : "Signature request has not completed.",
        ),
      );
    } else {
      const allRecipientsSigned =
        completedRequest.recipients.length > 0 &&
        completedRequest.recipients.every(
          (recipient) => recipient.status === "SIGNED",
        );

      if (!allRecipientsSigned) {
        blockers.push(
          blocker("SIGNATURE_INCOMPLETE", "Not every recipient has signed.", {
            signatureRequestId: completedRequest.id,
          }),
        );
      } else {
        signatureComplete = true;

        const artifact = completedRequest.artifact;
        const artifactReady =
          artifact !== null &&
          typeof artifact.sha256 === "string" &&
          artifact.sha256.length > 0;

        if (!artifactReady) {
          blockers.push(
            blocker(
              "SIGNED_ARTIFACT_MISSING",
              "The signed document artifact has not been mirrored yet.",
              { signatureRequestId: completedRequest.id },
            ),
          );
        } else {
          signedArtifactReady = true;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------

  return {
    ready: blockers.length === 0,
    blockers,
    summary: {
      requirementsTotal: tasks.length,
      requirementsCompleted: requirementsCompleted.length,
      verificationRequired: verificationRequiredTaskIds.size,
      verificationResolved,
      verificationIssuesOpen,
      signatureRequired,
      signatureComplete,
      signedArtifactReady,
    },
  };
}

function analysisVersionKey(
  taskId: string,
  documentVersionId: string,
): string {
  return `${taskId}:${documentVersionId}`;
}

function resolvePreferredVersion<
  V extends { documentId: string; versionNumber: number; isPrimary: boolean },
>(versions: V[]): Map<string, V> {
  const bestByDocument = new Map<string, V>();
  for (const version of versions) {
    const current = bestByDocument.get(version.documentId);
    if (!current) {
      bestByDocument.set(version.documentId, version);
      continue;
    }
    const better =
      (version.isPrimary && !current.isPrimary) ||
      (version.isPrimary === current.isPrimary &&
        version.versionNumber > current.versionNumber);
    if (better) {
      bestByDocument.set(version.documentId, version);
    }
  }
  return bestByDocument;
}

function blocker(
  code: CompletionBlockerCode,
  message: string,
  refs?: {
    taskId?: string;
    documentId?: string;
    signatureRequestId?: string;
  },
): CompletionBlocker {
  return {
    code,
    message,
    taskId: refs?.taskId,
    documentId: refs?.documentId,
    signatureRequestId: refs?.signatureRequestId,
  };
}
