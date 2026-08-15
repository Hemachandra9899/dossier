import prisma from "@/platform/db";
import type { CompletionReadiness } from "../domain/types";

export class CompletionReadinessFileNotFoundError extends Error {
  constructor() {
    super("File not found");
  }
}

export async function getCompletionReadiness(fileId: string): Promise<CompletionReadiness> {
  const file = await prisma.dossierFile.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    throw new CompletionReadinessFileNotFoundError();
  }

  const isReady = file.status === "READY_TO_CLOSE" || file.status === "COMPLETE";
  return {
    ready: isReady,
    blockers: isReady ? [] : [{ code: "REQUIREMENTS_INCOMPLETE", message: "Open items remaining" }],
    summary: {
      requirementsCount: 0,
      requirementsTotal: 0,
      completedRequirementsCount: 0,
      requirementsCompleted: 0,
      documentsCount: 0,
      verifiedDocumentsCount: 0,
      verificationResolved: true,
      signaturesCount: 0,
      completedSignaturesCount: 0,
      signatureRequired: false,
      signatureComplete: true,
      signedArtifactReady: true,
    },
  };
}
