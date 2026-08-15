// API client for the Files board.

import { apiRequest } from "@/platform/query/api-client";

import type {
  FileBoardItem,
  FileDetail,
  CreateFileInput,
  MoveFileInput,
} from "../file.types";

export const filesApi = {
  board(
    teamId: string,
    signal?: AbortSignal,
  ) {
    return apiRequest<{
      files: FileBoardItem[];
    }>(
      `/api/teams/${teamId}/files`,
      {
        signal,
      },
    );
  },

  detail(
    teamId: string,
    fileId: string,
    signal?: AbortSignal,
  ) {
    return apiRequest<FileDetail>(
      `/api/teams/${teamId}/files/${fileId}`,
      {
        signal,
      },
    );
  },

  create(
    teamId: string,
    input: CreateFileInput,
  ) {
    return apiRequest<{ file: FileBoardItem }>(
      `/api/teams/${teamId}/files`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  move(
    teamId: string,
    fileId: string,
    input: MoveFileInput,
  ) {
    return apiRequest<{ file: FileBoardItem }>(
      `/api/teams/${teamId}/files/${fileId}/move`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },
};