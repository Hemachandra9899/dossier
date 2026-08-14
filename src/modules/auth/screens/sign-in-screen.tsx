"use client";

import { useSearchParams } from "next/navigation";

import { ProductEntryShell } from "@/shared/shell/product-entry-shell";

import { AuthError } from "../components/auth-error";
import { SignInForm } from "../components/sign-in-form";

export function SignInScreen() {
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") ?? undefined;
  const error = searchParams?.get("error") ?? null;

  return (
    <ProductEntryShell>
      <div className="flex w-full max-w-4xl flex-col gap-10 md:flex-row md:items-center">
        <div className="flex w-full justify-center md:w-1/2 md:justify-start">
          <div className="w-full">
            <AuthError error={error} />
            <SignInForm next={next} />
          </div>
        </div>
        <div className="hidden w-1/2 md:block">
          <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-600/10 p-8">
            <h3 className="text-lg font-semibold text-foreground">
              The document workflow for modern teams
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Share files with real-time analytics</li>
              <li>Track requirements and verification</li>
              <li>Sign documents in one workspace</li>
            </ul>
          </div>
        </div>
      </div>
    </ProductEntryShell>
  );
}
