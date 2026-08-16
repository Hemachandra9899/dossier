// TanStack Query options for the Files board.

import { queryOptions } from "@tanstack/react-query";

import { filesApi } from "./files.api";
import { fileKeys } from "./files.keys";

export function fileBoardQuery(
  teamId: string,
) {
  return queryOptions({
    queryKey: fileKeys.board(teamId),

    queryFn: ({ signal }) =>
      filesApi.board(teamId, signal),

    enabled: Boolean(teamId),

    staleTime: 15_000,
  });
}

export function fileDetailQuery(
  teamId: string,
  fileId: string,
) {
  return queryOptions({
    queryKey: fileKeys.detail(teamId, fileId),

    queryFn: ({ signal }) =>
      filesApi.detail(teamId, fileId, signal),

    enabled: Boolean(teamId && fileId),

    staleTime: 15_000,
  });
}

export function fileActivityQuery(
  teamId: string,
  fileId: string,
) {
  return queryOptions({
    queryKey:
      fileKeys.activity(teamId, fileId),

    queryFn: ({ signal }) =>
      filesApi.activity(
        teamId,
        fileId,
        signal,
      ),

    enabled:
      Boolean(teamId && fileId),

    staleTime: 5_000,
  });
}