// Single QueryClient factory shared by every React tree (Pages Router app,
// App Router layout). One client per tree, never nested.

import { QueryClient } from "@tanstack/react-query";

import { isApiError } from "./query-errors";

const QUERY_DEFAULTS = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
} as const;

const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404]);

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && NON_RETRYABLE_STATUSES.has(error.status)) {
    return false;
  }
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_DEFAULTS.staleTime,
        gcTime: QUERY_DEFAULTS.gcTime,
        refetchOnWindowFocus: QUERY_DEFAULTS.refetchOnWindowFocus,
        refetchOnReconnect: QUERY_DEFAULTS.refetchOnReconnect,
        retry: shouldRetryQuery,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
