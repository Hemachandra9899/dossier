"use client";

import { useState } from "react";

import { toast } from "sonner";

import LinkedIn from "@/components/shared/icons/linkedin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useSignIn } from "../hooks/use-sign-in";
import { GoogleSignInButton } from "./google-sign-in-button";

export function RegisterForm({ next }: { next?: string }) {
  const { loadingMethod, signInWith } = useSignIn();
  const [email, setEmail] = useState("");

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email) return;

    const result = await signInWith("email", { email, callbackUrl: next });
    if (result?.ok && !result?.error) {
      setEmail("");
      toast.success("Email sent - check your inbox!");
    } else {
      toast.error("Error sending email - try again?");
    }
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-sm border border-border bg-gray-50 shadow-xl dark:bg-gray-900">
      <div className="flex flex-col items-center space-y-3 px-4 py-6 pt-8 text-center sm:px-16">
        <h1 className="text-2xl font-medium text-foreground">
          Start sharing documents
        </h1>
      </div>

      <form
        className="flex flex-col gap-4 p-4 pt-8 sm:px-16"
        onSubmit={handleEmailSubmit}
      >
        <Input
          className="border-4"
          placeholder="jsmith@company.co"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" loading={loadingMethod === "email"}>
          Continue with Email
        </Button>
      </form>

      <p className="text-center">or</p>

      <div className="flex flex-col space-y-2 px-4 py-8 sm:px-16">
        <GoogleSignInButton next={next} />
        <Button
          onClick={() => signInWith("linkedin", { callbackUrl: next })}
          loading={loadingMethod === "linkedin"}
          disabled={!!loadingMethod && loadingMethod !== "linkedin"}
          className="flex items-center justify-center space-x-2"
        >
          <LinkedIn />
          <span>Continue with LinkedIn</span>
        </Button>
      </div>
    </div>
  );
}
