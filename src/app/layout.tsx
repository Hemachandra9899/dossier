import { Inter } from "next/font/google";

import { buildMetadata } from "@/shared/config/metadata";
import { CoreProviders } from "@/shared/providers/core-providers";
import { QueryProvider } from "@/platform/query/query-provider";

import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = buildMetadata();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <CoreProviders>
          <QueryProvider>{children}</QueryProvider>
        </CoreProviders>
      </body>
    </html>
  );
}
