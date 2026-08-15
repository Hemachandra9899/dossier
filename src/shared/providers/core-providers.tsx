import React from "react";
import { ThemeProvider } from "./theme-provider";

export function CoreProviders({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
