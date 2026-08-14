"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useState } from "react";

import { signIn } from "next-auth/react";

import { LastUsed, useLastUsed } from "@/components/hooks/useLastUsed";
import Google from "@/components/shared/icons/google";
import { LogoCloud } from "@/components/shared/logo-cloud";
import { Button } from "@/components/ui/button";

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") ?? undefined;
  const authError = searchParams?.get("error");

  const [lastUsed, setLastUsed] = useLastUsed();
  const [clickedMethod, setClickedMethod] = useState<
    "google" | undefined
  >(undefined);

  void router;
  void authError;

  return (
    <div className="flex h-screen w-full flex-wrap">
      {/* Left part */}
      <div className="flex w-full justify-center bg-white md:w-[55%] lg:w-[55%]">
        <div className="z-10 mx-5 mt-0 h-fit w-full max-w-md overflow-hidden sm:mx-0 sm:mt-[calc(0.5vh)] md:mt-[calc(1vh)]">
          <div className="items-left flex flex-col space-y-3 px-4 py-6 pt-5 sm:px-12 sm:pt-6">
            <Link href="https://www.papermark.com" target="_blank">
              <img
                src="/_static/papermark-logo.svg"
                alt="Papermark Logo"
                className="mb-24 h-7 w-auto self-start sm:mb-20"
              />
            </Link>
            <Link href="/">
              <span className="text-balance text-3xl font-semibold text-gray-900">
                Welcome to Papermark
              </span>
            </Link>
            <h3 className="text-balance text-sm text-gray-800">
              Share documents. Not attachments.
            </h3>
          </div>
          <div className="flex flex-col space-y-2 px-4 sm:px-12">
            <div className="relative">
              <Button
                onClick={() => {
                  setClickedMethod("google");
                  setLastUsed("google");
                  signIn("google", {
                    ...(next && next.length > 0 ? { callbackUrl: next } : {}),
                  }).then(() => {
                    setClickedMethod(undefined);
                  });
                }}
                loading={clickedMethod === "google"}
                disabled={!!clickedMethod && clickedMethod !== "google"}
                className="flex w-full items-center justify-center space-x-2 border border-gray-300 bg-gray-100 font-normal text-gray-900 hover:bg-gray-200"
              >
                <Google className="h-5 w-5" />
                <span>Continue with Google</span>
                {clickedMethod !== "google" && lastUsed === "google" && (
                  <LastUsed />
                )}
              </Button>
            </div>
          </div>
          <p className="mt-10 w-full max-w-md px-4 text-xs text-muted-foreground sm:px-12">
            By continuing, you agree to Papermark&apos;s{" "}
            <a
              href="https://www.papermark.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://www.papermark.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
      <div
        className="relative hidden w-full justify-center overflow-hidden md:flex md:w-[45%] lg:w-[45%]"
        style={{ backgroundColor: "#f9fafb" }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center px-4 py-10">
          <div className="flex w-full max-w-xl flex-col items-center">
            <div className="mb-6 w-full max-w-md">
              <img
                className="h-auto w-full rounded-[4px] object-cover"
                src="/_static/testimonials/backtrace.jpeg"
                alt="Backtrace Capital"
              />
            </div>
            <div className="w-full max-w-3xl text-center">
              <blockquote
                className="leading-8 text-gray-900 sm:text-xl sm:leading-9"
                style={{
                  fontFamily:
                    "system-ui, 'Helvetica Neue', Helvetica, Arial, sans-serif",
                }}
              >
                <p>
                  &quot;We raised €50M Fund with Papermark Data Rooms.
                  <br />
                  Secure, branded, and incredibly easy to use.&quot;
                </p>
              </blockquote>
              <figcaption className="mt-4">
                <div className="text-balance font-medium text-gray-900">
                  Michael Münnix
                </div>
                <div className="text-balance font-light text-gray-500">
                  Partner, Backtrace Capital
                </div>
              </figcaption>
            </div>
          </div>
          <div className="mt-20 flex w-full max-w-md flex-col items-center">
            <LogoCloud />
          </div>
        </div>
      </div>
    </div>
  );
}
