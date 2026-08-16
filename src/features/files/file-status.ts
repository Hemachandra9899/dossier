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
  NEW: "new",
  COLLECTING: "collecting",
  WAITING_ON_CLIENT: "waiting on client",
  REVIEWING: "reviewing",
  NEEDS_CORRECTION: "needs correction",
  READY_TO_SIGN: "ready to sign",
  SIGNING: "signing",
  READY_TO_CLOSE: "ready to close",
  COMPLETE: "complete",
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