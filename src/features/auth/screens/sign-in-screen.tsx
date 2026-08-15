"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { LastUsed, useLastUsed } from "@/shared/ui/hooks/useLastUsed";
import Google from "@/shared/ui/shared/icons/google";
import { LogoCloud } from "@/shared/ui/shared/logo-cloud";
import { Button } from "@/shared/ui/button";
import { toast } from "sonner";

export function SignInScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams?.get("next") ?? searchParams?.get("callbackUrl") ?? undefined;
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const authError = searchParams?.get("error");

  const [lastUsed, setLastUsed] = useLastUsed();
  const [clickedMethod, setClickedMethod] = useState<"google" | undefined>(undefined);

  React.useEffect(() => {
    if (authError) {
      if (authError === "OAuthAccountNotLinked") {
        toast.error("This email is already associated with an account.");
      } else {
        toast.error(`Authentication error: ${authError}`);
      }
    }
  }, [authError]);

  return (
    <div className="flex min-h-screen w-full flex-wrap">
      {/* Left Login Form Panel */}
      <div className="flex w-full justify-center bg-background md:w-[55%] lg:w-[55%]">
        <div className="z-10 mx-5 mt-0 h-fit w-full max-w-md overflow-hidden sm:mx-0 sm:mt-[calc(5vh)] md:mt-[calc(8vh)]">
          <div className="flex flex-col space-y-3 px-4 py-6 pt-5 sm:px-12 sm:pt-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 mb-16 sm:mb-12">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow">
                D
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">Dossier</span>
            </Link>
            <span className="text-balance text-3xl font-semibold tracking-tight text-foreground">
              Welcome to Dossier
            </span>
            <h3 className="text-balance text-sm text-muted-foreground">
              Secure client dossiers, data rooms, verification, and closing binders.
            </h3>
          </div>

          <div className="flex flex-col space-y-3 px-4 sm:px-12">
            <div className="relative">
              <Button
                onClick={() => {
                  setClickedMethod("google");
                  setLastUsed("google");
                  signIn("google", {
                    callbackUrl: next,
                  }).then(() => {
                    setClickedMethod(undefined);
                  });
                }}
                loading={clickedMethod === "google"}
                disabled={!!clickedMethod && clickedMethod !== "google"}
                className="flex w-full items-center justify-center space-x-2 border border-border bg-muted/50 font-medium text-foreground hover:bg-muted py-5 text-sm"
              >
                <Google className="h-5 w-5 shrink-0" />
                <span>Continue with Google</span>
                {clickedMethod !== "google" && lastUsed === "google" && (
                  <LastUsed />
                )}
              </Button>
            </div>
          </div>

          <p className="mt-12 w-full max-w-md px-4 text-xs text-muted-foreground sm:px-12">
            By continuing, you agree to Dossier&apos;s{" "}
            <a
              href="https://dossier.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://dossier.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>

      {/* Right Testimonial & Logo Panel */}
      <div
        className="relative hidden w-full justify-center overflow-hidden md:flex md:w-[45%] lg:w-[45%] border-l bg-muted/20"
      >
        <div className="flex h-full w-full flex-col items-center justify-center px-6 py-12">
          <div className="flex w-full max-w-lg flex-col items-center text-center">
            <div className="mb-8 w-full max-w-md overflow-hidden rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                  D
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Verified Client Dossiers</h4>
                  <p className="text-xs text-muted-foreground">Automated diligence and signing workflow</p>
                </div>
              </div>
            </div>

            <blockquote className="leading-relaxed text-foreground text-lg sm:text-xl font-medium max-w-md">
              &quot;We manage multi-million dollar transactions with Dossier Data Rooms. Secure, branded, and automated from intake to closing binder.&quot;
            </blockquote>
            <figcaption className="mt-4">
              <div className="font-semibold text-sm text-foreground">
                Executive Partner
              </div>
              <div className="text-xs text-muted-foreground">
                Global Capital & Advisory
              </div>
            </figcaption>
          </div>

          <div className="mt-16 flex w-full max-w-md flex-col items-center">
            <LogoCloud />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignInScreen;
