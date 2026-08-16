// /signing/:requestId — recipient landing page. When the URL carries the
// long-lived invitation token, it is exchanged for a short-lived HttpOnly
// cookie and scrubbed from the URL so it never lingers in history. Without a
// token the page relies on the cookie from a prior exchange; the info API
// 404s otherwise and the page shows the not-found state.

import { useEffect, useState } from "react";

import { useRouter } from "next/router";
import { AlertCircleIcon } from "lucide-react";

import LoadingSpinner from "@/shared/ui/loading-spinner";
import { signingApi } from "@/features/signing/api/signing-api";

import { SigningRequestPage } from "@/features/signing/ui/signing/signing-request-page";

type AuthState = "loading" | "ready" | "error";

export default function SigningPage() {
  const router = useRouter();
  const { requestId, token } = router.query;

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState<string | null>(null);

  const requestIdValue = typeof requestId === "string" ? requestId : "";
  const tokenValue = typeof token === "string" && token.length > 0 ? token : null;

  useEffect(() => {
    if (!router.isReady) return;

    let cancelled = false;

    if (!requestIdValue) {
      setAuthState("error");
      setAuthError("This signing link is invalid.");
      return;
    }

    if (!tokenValue) {
      setAuthState("ready");
      return;
    }

    setAuthState("loading");
    signingApi
      .exchangeRecipientAccessToken({
        requestId: requestIdValue,
        token: tokenValue,
      })
      .then(() => {
        if (cancelled) return;
        void router.replace(
          {
            pathname: router.pathname,
            query: { requestId: requestIdValue },
          },
          undefined,
          { shallow: true },
        );
        setAuthState("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setAuthError(
          error instanceof Error
            ? error.message
            : "This signing link could not be opened.",
        );
        setAuthState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [router, router.isReady, requestIdValue, tokenValue]);

  if (authState === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-secondary">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  if (authState === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-secondary px-4 text-center">
        <AlertCircleIcon className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Signature request not found</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {authError ?? "This signing link is invalid or expired."}
        </p>
      </div>
    );
  }

  return <SigningRequestPage requestId={requestIdValue} />;
}
