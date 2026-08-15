// Signing mutation definitions. Each export is a set of useMutation() options
// scoped to a QueryClient so cache updates (setQueryData / invalidation) stay
// co-located with the mutation. Components spread the options and may compose
// extra onSuccess side effects.
//
// Signing state is never optimistically updated: mutations wait for the server
// response, then write the returned entity or invalidate the affected keys.

import type { QueryClient } from "@tanstack/react-query";

import { signingApi } from "./signing-api";
import { signingKeys } from "./signing.keys";

export function createSignatureRequestOptions(queryClient: QueryClient) {
  return {
    mutationFn: signingApi.createRequest,
    onSuccess: (
      _result: { requestId: string; status: string },
      input: Parameters<typeof signingApi.createRequest>[0],
    ) => {
      queryClient.invalidateQueries({
        queryKey: signingKeys.requests.activeForDocument(
          input.teamId,
          input.documentId,
        ),
      });
    },
  };
}

export function cancelSignatureRequestOptions(queryClient: QueryClient) {
  return {
    mutationFn: signingApi.cancelRequest,
    onSuccess: (
      data: { request: { id: string; documentId: string } },
      input: Parameters<typeof signingApi.cancelRequest>[0],
    ) => {
      queryClient.setQueryData(
        signingKeys.requests.detail(input.teamId, input.requestId),
        data,
      );
      queryClient.invalidateQueries({
        queryKey: signingKeys.requests.activeForDocument(
          input.teamId,
          data.request.documentId,
        ),
      });
    },
  };
}

export function remindSignatureRequestOptions(queryClient: QueryClient) {
  return {
    mutationFn: signingApi.remindRequest,
    onSuccess: (
      _result: { ok: boolean },
      input: Parameters<typeof signingApi.remindRequest>[0],
    ) => {
      queryClient.invalidateQueries({
        queryKey: signingKeys.requests.detail(input.teamId, input.requestId),
      });
    },
  };
}

export function createSigningSessionOptions() {
  return {
    mutationFn: signingApi.createSigningSession,
  };
}
