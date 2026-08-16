// Service layer for Files board operations.

import { getFilesForBoard } from "./file.repository";
import { useInvalidateFileState } from "./api/files.mutations";

import type { FileBoardItem } from "./file.types";

export async function getFileBoardService(
  actor: {
    userId: string;
    teamId: string;
  },
): Promise<FileBoardItem[]> {
  return await getFilesForBoard(actor.teamId);
}

export function useInvalidateFileStateService(
  teamId: string,
  fileId: string,
) {
  return useInvalidateFileState(teamId, fileId);
}