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
  | "COMPLETE";

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
  NEW: "New",
  COLLECTING: "Collecting",
  WAITING_ON_CLIENT: "Waiting on client",
  REVIEWING: "Review",
  NEEDS_CORRECTION: "Needs correction",
  READY_TO_SIGN: "Ready to sign",
  SIGNING: "Signing",
  READY_TO_CLOSE: "Ready to close",
  COMPLETE: "Complete",
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
  const groups =
    Object.fromEntries(
      FILE_STATUSES.map((status) => [status, []]),
    ) as Record<(typeof FILE_STATUSES)[number], any[]>;

  for (const file of files) {
    groups[file.status].push(file);
  }

  return groups;
};