// TanStack Query keys for the Files board.

export const fileKeys = {
  all: ["files"] as const,

  team: (teamId: string) =>
    ["files", teamId] as const,

  board: (teamId: string) =>
    ["files", teamId, "board"] as const,

  detail: (
    teamId: string,
    fileId: string,
  ) =>
    ["files", teamId, "detail", fileId] as const,

  activity: (
    teamId: string,
    fileId: string,
  ) =>
    [
      "files",
      teamId,
      "detail",
      fileId,
      "activity",
    ] as const,

  requirements: (
    teamId: string,
    fileId: string,
  ) =>
    ["files", teamId, fileId, "requirements"] as const,

  documents: (
    teamId: string,
    fileId: string,
  ) =>
    ["files", teamId, fileId, "documents"] as const,
};