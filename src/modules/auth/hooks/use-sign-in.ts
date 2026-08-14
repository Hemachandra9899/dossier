"use client";

import { useCallback, useState } from "react";

import { signIn } from "next-auth/react";

import { normalizeCallbackUrl } from "@/shared/lib/safe-redirect";

import type { SignInMethod } from "../auth.types";

type SignInOptions = {
  callbackUrl?: string;
  email?: string;
};

export function useSignIn() {
  const [loadingMethod, setLoadingMethod] = useState<
    SignInMethod | undefined
  >(undefined);

  const signInWith = useCallback(
    async (provider: SignInMethod, options: SignInOptions = {}) => {
      const callbackUrl = normalizeCallbackUrl(options.callbackUrl);

      setLoadingMethod(provider);
      try {
        if (provider === "email") {
          return await signIn("email", {
            email: options.email,
            redirect: false,
            ...(callbackUrl ? { callbackUrl } : {}),
          });
        }

        await signIn(provider, {
          ...(callbackUrl ? { callbackUrl } : {}),
        });
        return undefined;
      } catch {
        return undefined;
      } finally {
        setLoadingMethod(undefined);
      }
    },
    [],
  );

  return { loadingMethod, signInWith };
}
