"use client";

import { LastUsed, useLastUsed } from "@/shared/ui/hooks/useLastUsed";
import Google from "@/shared/ui/shared/icons/google";
import { Button } from "@/shared/ui/button";

import { useSignIn } from "../hooks/use-sign-in";

export function GoogleSignInButton({ next }: { next?: string }) {
  const { loadingMethod, signInWith } = useSignIn();
  const [lastUsed, setLastUsed] = useLastUsed();

  const loading = loadingMethod === "google";

  return (
    <Button
      onClick={() => {
        setLastUsed("google");
        signInWith("google", { callbackUrl: next });
      }}
      loading={loading}
      disabled={!!loadingMethod && loadingMethod !== "google"}
      className="flex w-full items-center justify-center space-x-2 border border-gray-300 bg-gray-100 font-normal text-gray-900 hover:bg-gray-200"
    >
      <Google className="h-5 w-5" />
      <span>Continue with Google</span>
      {!loading && lastUsed === "google" && <LastUsed />}
    </Button>
  );
}
