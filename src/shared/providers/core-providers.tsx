"use client";

import { SessionProvider } from "next-auth/react";

import { ThemeProvider } from "@/shared/ui/theme-provider";
import { Toaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";

export function CoreProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider delayDuration={100}>
          {children}
          <Toaster closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
