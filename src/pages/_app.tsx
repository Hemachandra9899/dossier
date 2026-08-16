import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import Head from "next/head";

import { TeamProvider } from "@/features/workspace/providers/workspace-provider";
import { UploadProgressProvider } from "@/features/files/upload/upload-progress-context";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/pages";

import { EXCLUDED_PATHS } from "@/shared/utils/constants";
import { useTrackLastVisited } from "@/shared/utils/hooks/use-last-visited";
import { QueryProvider } from "@/platform/query/query-provider";

import { PostHogGroupSync } from "@/shared/providers/posthog-group-sync";
import { PostHogCustomProvider } from "@/shared/providers/posthog-provider";
import { ThemeProvider } from "@/shared/providers/theme-provider";
import { Toaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { productConfig } from "@/shared/config/product";

import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

function LastVisitedTracker() {
  useTrackLastVisited();
  return null;
}

export default function App({
  Component,
  pageProps: { session, ...pageProps },
  router,
}: AppProps<{ session: Session }>) {
  return (
    <>
      <Head>
        <title>{productConfig.name}</title>
        <meta name="theme-color" content="#000000" key="theme-color" />
        <meta
          name="description"
          content={productConfig.description}
          key="description"
        />
        <meta property="og:title" content={productConfig.name} key="og-title" />
        <meta
          property="og:description"
          content={productConfig.description}
          key="og-description"
        />
        <meta
          property="og:image"
          content={`${productConfig.baseUrl}${productConfig.metaImage}`}
          key="og-image"
        />
        <meta
          property="og:url"
          content={productConfig.baseUrl}
          key="og-url"
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content={productConfig.social.twitter} />
        <meta name="twitter:creator" content={productConfig.social.twitter} />
        <meta name="twitter:title" content={productConfig.name} key="tw-title" />
        <meta
          name="twitter:description"
          content={productConfig.description}
          key="tw-description"
        />
        <meta
          name="twitter:image"
          content={`${productConfig.baseUrl}${productConfig.metaImage}`}
          key="tw-image"
        />
        <link rel="icon" href="/favicon.ico" key="favicon" />
      </Head>
      <SessionProvider session={session}>
        <PostHogCustomProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <NuqsAdapter>
              <QueryProvider>
                <main className={inter.className}>
                  <Toaster closeButton />
                  <TooltipProvider delayDuration={100}>
                    {EXCLUDED_PATHS.includes(router.pathname) ? (
                      <Component {...pageProps} />
                    ) : (
                      <TeamProvider>
                        <PostHogGroupSync />
                        <LastVisitedTracker />
                        <UploadProgressProvider>
                          <Component {...pageProps} />
                        </UploadProgressProvider>
                      </TeamProvider>
                    )}
                  </TooltipProvider>
                </main>
              </QueryProvider>
            </NuqsAdapter>
          </ThemeProvider>
        </PostHogCustomProvider>
      </SessionProvider>
    </>
  );
}
