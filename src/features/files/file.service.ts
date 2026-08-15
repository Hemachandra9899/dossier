// Service layer for Files board operations.

import { getFileBoard } from "./file.repository";
import { useInvalidateFileState } from "./api/files.mutations";

export async function getFileBoardService(
  actor: {
    userId: string;
    teamId: string;
  },
): Promise<FileBoardItem[]> {
  return await getFileBoard(actor.teamId);
}

export function useInvalidateFileStateService(
  teamId: string,
  fileId: string,
) {
  return useInvalidateFileState(teamId, fileId);
}