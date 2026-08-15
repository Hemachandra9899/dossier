"use client";

import Link from "next/link";

import { productConfig } from "@/shared/config/product";

import { GoogleSignInButton } from "./google-sign-in-button";

export function SignInForm({ next }: { next?: string }) {
  return (
    <div className="w-full max-w-md">
      <h1 className="text-balance text-3xl font-semibold text-gray-900">
        Welcome to {productConfig.name}
      </h1>
      <h2 className="text-balance text-sm text-gray-800">
        Share documents. Not attachments.
      </h2>

      <div className="mt-6 flex flex-col space-y-2">
        <GoogleSignInButton next={next} />
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        By continuing, you agree to {productConfig.name}&apos;s{" "}
        <Link
          href={productConfig.legal.terms}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href={productConfig.legal.privacy}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
