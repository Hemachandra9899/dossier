// useRecipientSigningUrl: mints the per-recipient access token (sender-side)
// and builds the shareable signing link. Fetching the token is async, so the
// success/review surfaces render a loading state until the link is ready.

"use client";

import { useCallback, useEffect, useState } from "react";

import {
  buildRecipientSigningUrl,
  signingApi,
} from "@/features/signing/api/signing-api";

export function useRecipientSigningUrl(input: {
  teamId: string;
  requestId: string;
  recipientId: string | null;
  enabled?: boolean;
}) {
  const [state, setState] = useState<{
    url: string | null;
    isLoading: boolean;
    error: string | null;
  }>({
    url: null,
    isLoading: !!input.recipientId && input.enabled !== false,
    error: null,
  });

  const load = useCallback(async () => {
    if (!input.recipientId || input.enabled === false) {
      setState({ url: null, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const { access } = await signingApi.getRecipientAccessToken({
        teamId: input.teamId,
        requestId: input.requestId,
        recipientId: input.recipientId,
      });
      setState({
        url: buildRecipientSigningUrl({
          requestId: input.requestId,
          token: access.token,
        }),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState({
        url: null,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not build the signing link.",
      });
    }
  }, [input.teamId, input.requestId, input.recipientId, input.enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refetch: load };
}
