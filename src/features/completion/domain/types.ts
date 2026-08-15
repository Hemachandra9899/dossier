export interface CompletionBlocker {
  code: string;
  message: string;
}

export interface CompletionReadinessSummary {
  requirementsCount: number;
  requirementsTotal: number;
  completedRequirementsCount: number;
  requirementsCompleted: number;
  documentsCount: number;
  verifiedDocumentsCount: number;
  verificationResolved: boolean;
  signaturesCount: number;
  completedSignaturesCount: number;
  signatureRequired: boolean;
  signatureComplete: boolean;
  signedArtifactReady: boolean;
}

export interface CompletionReadiness {
  ready: boolean;
  blockers: CompletionBlocker[];
  summary: CompletionReadinessSummary;
}
