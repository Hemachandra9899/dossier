"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { ProductEntryShell } from "@/shared/shell/product-entry-shell";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { toast } from "sonner";

export function SignInScreen() {
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams?.get("callbackUrl") || "/dashboard";
  const callbackUrl =
    rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/dashboard";
  const errorParam = searchParams?.get("error");

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }
    setIsLoading(true);
    try {
      const res = await signIn("email", {
        email: email.trim().toLowerCase(),
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Check your email for a sign-in link!");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to send sign-in link.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch (err: any) {
      toast.error("Google sign in failed.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <ProductEntryShell
      title="Sign in to Dossier"
      subtitle="Enter your email to receive a magic link"
    >
      {errorParam && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          Authentication failed: {errorParam}
        </div>
      )}
      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            className="mt-1"
          />
        </div>
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Sending link..." : "Sign in with Email"}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200 dark:border-neutral-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-neutral-800 px-2 text-neutral-500">
            Or continue with
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading}
        className="w-full"
      >
        {isGoogleLoading ? "Connecting..." : "Sign in with Google"}
      </Button>
    </ProductEntryShell>
  );
}

export default SignInScreen;
