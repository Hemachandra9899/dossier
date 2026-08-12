import {
  DossierFileStatus,
  SignatureRequestStatus,
} from "@prisma/client";

export type RequirementSnapshot = {
  status: string;
  hasExternalAssignment: boolean;
};

export type SignatureSnapshot = {
  status: SignatureRequestStatus;
};

const ACTIVE_SIGNATURE_STATUSES = new Set<SignatureRequestStatus>([
  SignatureRequestStatus.DRAFT,
  SignatureRequestStatus.PREPARING,
  SignatureRequestStatus.READY,
  SignatureRequestStatus.SENT,
  SignatureRequestStatus.VIEWED,
  SignatureRequestStatus.SIGNING,
  SignatureRequestStatus.PARTIALLY_SIGNED,
]);

export function deriveFileStatus(input: {
  currentStatus: DossierFileStatus;
  requirements: RequirementSnapshot[];
  requiresSignature: boolean;
  signatures: SignatureSnapshot[];
}): DossierFileStatus {
  const {
    currentStatus,
    requirements,
    requiresSignature,
    signatures,
  } = input;

  if (currentStatus === DossierFileStatus.ARCHIVED) {
    return DossierFileStatus.ARCHIVED;
  }

  // Explicit correction is sticky until a reviewer resolves/reopens it.
  if (currentStatus === DossierFileStatus.NEEDS_CORRECTION) {
    return DossierFileStatus.NEEDS_CORRECTION;
  }

  if (requirements.length === 0) {
    return DossierFileStatus.NEW;
  }

  const allRequirementsComplete = requirements.every(
    (r) => r.status === "COMPLETED",
  );

  const anySubmitted = requirements.some(
    (r) => r.status === "SUBMITTED",
  );

  const incomplete = requirements.filter(
    (r) => r.status !== "COMPLETED",
  );

  const anyWaitingOnExternalParty = incomplete.some(
    (r) => r.hasExternalAssignment,
  );

  if (!allRequirementsComplete) {
    if (anySubmitted) return DossierFileStatus.REVIEWING;
    if (anyWaitingOnExternalParty) {
      return DossierFileStatus.WAITING_ON_CLIENT;
    }
    return DossierFileStatus.COLLECTING;
  }

  if (!requiresSignature) {
    return DossierFileStatus.COMPLETE;
  }

  if (signatures.length === 0) {
    return DossierFileStatus.READY_TO_SIGN;
  }

  const allSignaturesComplete = signatures.every(
    (s) => s.status === SignatureRequestStatus.COMPLETED,
  );

  if (allSignaturesComplete) {
    return DossierFileStatus.COMPLETE;
  }

  const anyActiveSignature = signatures.some((s) =>
    ACTIVE_SIGNATURE_STATUSES.has(s.status),
  );

  if (anyActiveSignature) {
    return DossierFileStatus.SIGNING;
  }

  return DossierFileStatus.READY_TO_SIGN;
}
