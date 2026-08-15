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

export function fileRequirementsQuery(
  teamId: string,
  fileId: string,
) {
  return queryOptions({
    queryKey: fileKeys.requirements(teamId, fileId),

    queryFn: async () => {
      // Will be implemented by the signing/requirements feature
      // to keep this file lightweight; the tab-specific query
      // lives in the Signatures/Requirements feature module.
      return Promise.resolve({} as any);
    },

    enabled: Boolean(teamId && fileId),

    staleTime: 5_000,
  });
}

export function fileDocumentsQuery(
  teamId: string,
  fileId: string,
) {
  return queryOptions({
    queryKey: fileKeys.documents(teamId, fileId),

    queryFn: async () => {
      // Placeholder — Documents feature owns its own query.
      return Promise.resolve([] as any);
    },

    enabled: Boolean(teamId && fileId),

    staleTime: 30_000,
  });
}

export function fileActivityQuery(
  teamId: string,
  fileId: string,
) {
  return queryOptions({
    queryKey: fileKeys.activity(teamId, fileId),

    queryFn: async () => {
      // Placeholder — Activity feature owns its own query.
      return Promise.resolve([] as any);
    },

    enabled: Boolean(teamId && fileId),

    staleTime: 5_000,
  });
}

export function fileCompletionReadinessQuery(
  fileId: string,
) {
  return queryOptions({
    queryKey: ["files", "completion-readiness", fileId],

    queryFn: async () => {
      // Placeholder — Completion feature owns its own readiness check.
      return {
        ready: false,
        requirements: 0,
        verified: 0,
        signed: 0,
        artifactReady: false,
      };
    },

    enabled: Boolean(fileId),

    staleTime: 5_000,
  });
}