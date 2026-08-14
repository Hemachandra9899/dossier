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

// Terminal signature states that supersede older requests. A cancelled/failed/
// declined/expired request must never block a later successfully completed one.
const IGNORED_TERMINAL_SIGNATURE_STATUSES = new Set<SignatureRequestStatus>([
  SignatureRequestStatus.CANCELLED,
  SignatureRequestStatus.FAILED,
  SignatureRequestStatus.DECLINED,
  SignatureRequestStatus.EXPIRED,
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

  // COMPLETE is sticky/legacy: only a future CP10 finalization service may
  // move a file into COMPLETE. Sync never derives it automatically anymore.
  if (currentStatus === DossierFileStatus.COMPLETE) {
    return DossierFileStatus.COMPLETE;
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
    return DossierFileStatus.READY_TO_CLOSE;
  }

  // Only consider "relevant current" requests: ignore superseded terminal
  // requests so a later successful request is not blocked by history.
  const relevant = signatures.filter(
    (s) => !IGNORED_TERMINAL_SIGNATURE_STATUSES.has(s.status),
  );

  if (relevant.some((s) => s.status === SignatureRequestStatus.COMPLETED)) {
    return DossierFileStatus.READY_TO_CLOSE;
  }

  if (relevant.some((s) => ACTIVE_SIGNATURE_STATUSES.has(s.status))) {
    return DossierFileStatus.SIGNING;
  }

  return DossierFileStatus.READY_TO_SIGN;
}
