export type CompletionBlockerCode =
  | "REQUIREMENTS_INCOMPLETE"
  | "DOCUMENT_MISSING"
  | "DOCUMENT_VERSION_MISSING"
  | "VERIFICATION_MISSING"
  | "VERIFICATION_PENDING"
  | "VERIFICATION_FAILED"
  | "VERIFICATION_UNRESOLVED"
  | "SIGNATURE_REQUIRED_NOT_STARTED"
  | "SIGNATURE_INCOMPLETE"
  | "SIGNED_ARTIFACT_MISSING";

export type CompletionBlocker = {
  code: CompletionBlockerCode;
  message: string;
  taskId?: string;
  documentId?: string;
  signatureRequestId?: string;
};

export type CompletionReadiness = {
  ready: boolean;

  blockers: CompletionBlocker[];

  summary: {
    requirementsTotal: number;
    requirementsCompleted: number;

    verificationRequired: number;
    verificationResolved: number;
    verificationIssuesOpen: number;

    signatureRequired: boolean;
    signatureComplete: boolean;
    signedArtifactReady: boolean;
  };
};
