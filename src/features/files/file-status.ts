// File status lifecycle. These are the board column statuses.

export type FileStatus =
  | "NEW"
  | "COLLECTING"
  | "WAITING_ON_CLIENT"
  | "REVIEWING"
  | "NEEDS_CORRECTION"
  | "READY_TO_SIGN"
  | "SIGNING"
  | "READY_TO_CLOSE"
  | "COMPLETE"
  | "ARCHIVED";

export type FileRequirementStatus = {
  status: "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "COMPLETED";
  hasExternalAssignment: boolean;
};

export type FileSignatureStatus =
  | "DRAFT"
  | "PREPARING"
  | "READY"
  | "SENT"
  | "VIEWED"
  | "SIGNING"
  | "PARTIALLY_SIGNED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "DECLINED"
  | "EXPIRED";

export const FILE_STATUSES = [
  "NEW",
  "COLLECTING",
  "WAITING_ON_CLIENT",
  "REVIEWING",
  "NEEDS_CORRECTION",
  "READY_TO_SIGN",
  "SIGNING",
  "READY_TO_CLOSE",
  "COMPLETE",
] as const;

export const FILE_STATUS_LABEL: Record<FileStatus, string> = {
  NEW: "new",
  COLLECTING: "collecting",
  WAITING_ON_CLIENT: "waiting on client",
  REVIEWING: "reviewing",
  NEEDS_CORRECTION: "needs correction",
  READY_TO_SIGN: "ready to sign",
  SIGNING: "signing",
  READY_TO_CLOSE: "ready to close",
  COMPLETE: "complete",
  ARCHIVED: "archived",
};

export const fileStatusLabels = {
  NEW: "NEW",
  COLLECTING: "COLLECTING",
  WAITING_ON_CLIENT: "WAITING_ON_CLIENT",
  REVIEWING: "REVIEWING",
  NEEDS_CORRECTION: "NEEDS_CORRECTION",
  READY_TO_SIGN: "READY_TO_SIGN",
  SIGNING: "SIGNING",
  READY_TO_CLOSE: "READY_TO_CLOSE",
  COMPLETE: "COMPLETE",
  ARCHIVED: "ARCHIVED",
};

// Statuses that can be manually moved by users on the board.
export const MANUALLY_TRANSITIONABLE_STATUSES = new Set([
  "NEW",
  "COLLECTING",
  "WAITING_ON_CLIENT",
]);

// Statuses that are controlled by the workflow (requirements, verification, signing, completion).
export const WORKFLOW_CONTROLLED_STATUSES = new Set([
  "REVIEWING",
  "NEEDS_CORRECTION",
  "READY_TO_SIGN",
  "SIGNING",
  "READY_TO_CLOSE",
  "COMPLETE",
]);

export function groupFilesByStatus(
  files: any[],
): Record<(typeof FILE_STATUSES)[number], any[]> {
  const groups = Object.fromEntries(
    FILE_STATUSES.map((status) => [status, [] as any[]]),
  ) as Record<(typeof FILE_STATUSES)[number], any[]>;

  for (const file of files) {
    const bucket = groups[file.status as (typeof FILE_STATUSES)[number]];
    if (bucket) {
      bucket.push(file);
    }
  }

  return groups;
}

/**
 * Derive the authoritative FileStatus from the current state.
 *
 * This is the one pure derivation function for file status.
 * It does NOT query Prisma, does NOT send email, does NOT call provider APIs.
 *
 * Input fields needed:
 *   currentStatus: the file's current status
 *   requirements: each requirement's status + whether it has an external assignment
 *   requiresSignature: whether the file requires signatures
 *   signatures: the signature requests associated with this file
 *
 * Rules are ordered from most specific to most general.
 * Duplicate STATUS_CHANGED events must not be generated when status is unchanged.
 */
export function deriveFileStatus(
  input: {
    currentStatus: FileStatus;

    requirements: FileRequirementStatus[];

    requiresSignature: boolean;

    signatures: FileSignatureStatus[];
  },
): FileStatus {
  const {
    currentStatus,
    requirements,
    requiresSignature,
    signatures,
  } = input;

  // --- Terminal states stay sticky forever ---
  if (currentStatus === "ARCHIVED") {
    return "ARCHIVED";
  }
  if (currentStatus === "COMPLETE") {
    return "COMPLETE";
  }

  // --- No requirements yet ---
  if (requirements.length === 0) {
    return "NEW";
  }

  // --- NEEDS_CORRECTION is sticky: once in correction mode, stay until
  // explicitly moved out via syncFileStatus (e.g., after corrected upload).
  if (currentStatus === "NEEDS_CORRECTION") {
    return "NEEDS_CORRECTION";
  }

  // --- Check if all requirements are completed ---
  const allCompleted = requirements.every((r) => r.status === "COMPLETED");
  const hasSubmitted = requirements.some((r) => r.status === "SUBMITTED");
  const hasIncomplete = requirements.some((r) => r.status !== "COMPLETED");
  const waitingOnClient =
    hasIncomplete &&
    requirements.some((r) => r.status !== "COMPLETED" && r.hasExternalAssignment);

  // --- Requirements not all completed ---
  if (!allCompleted) {
    if (hasSubmitted) {
      return "REVIEWING";
    }
    if (waitingOnClient) {
      return "WAITING_ON_CLIENT";
    }
    return "COLLECTING";
  }

  // --- All requirements completed ---
  if (!requiresSignature) {
    return "READY_TO_CLOSE";
  }

  // --- Signature required ---
  // Filter out historical terminal requests that should not block status
  const activeSignatures = signatures.filter(
    (s) =>
      !["CANCELLED", "FAILED", "DECLINED", "EXPIRED"].includes(s),
  );

  const completedSignature = signatures.find(
    (s) => s === "COMPLETED",
  );

  if (completedSignature) {
    return "READY_TO_CLOSE";
  }

  const activeSignature = signatures.find(
    (s) =>
      ["DRAFT", "PREPARING", "READY", "SENT", "VIEWED", "SIGNING", "PARTIALLY_SIGNED"].includes(
        s,
      ),
  );

  if (activeSignature) {
    return "SIGNING";
  }

  // No active signature, but signing is required
  return "READY_TO_SIGN";
}