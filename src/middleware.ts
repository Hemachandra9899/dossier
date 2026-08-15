import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

import AppMiddleware from "@/shared/utils/middleware/app";
import DomainMiddleware from "@/shared/utils/middleware/domain";
import IncomingWebhookMiddleware, {
  isWebhookPath,
} from "@/shared/utils/middleware/incoming-webhooks";
import PostHogMiddleware from "@/shared/utils/middleware/posthog";

function isAnalyticsPath(path: string) {
  const pattern = /^\/ingest\/.*/;
  return pattern.test(path);
}

function isCustomDomain(host: string) {
  return (
    (process.env.NODE_ENV === "development" &&
      (host?.includes(".local") || host?.includes("papermark.dev"))) ||
    (process.env.NODE_ENV !== "development" &&
      !(
        host?.includes("localhost") ||
        host?.includes("papermark.io") ||
        host?.includes("papermark.com") ||
        host?.endsWith(".vercel.app")
      ))
  );
}

export const config = {
  matcher: [
    "/((?!api/|oauth/|mcp/?$|\\.well-known/|_next/|_static|vendor|_icons|_vercel|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  const path = req.nextUrl.pathname;
  const host = req.headers.get("host");

  const apiHost = process.env.NEXT_PUBLIC_API_BASE_HOST?.toLowerCase().trim();
  const requestHostname = host?.split(":")[0]?.toLowerCase().trim();
  if (apiHost && requestHostname === apiHost) {
    if (path === "/v1" || path.startsWith("/v1/") || path === "/openapi.json") {
      return NextResponse.next();
    }
    if (path === "/") {
      return NextResponse.redirect("https://www.papermark.com/docs/api", 302);
    }
    return new NextResponse(null, { status: 404 });
  }

  if (isAnalyticsPath(path)) {
    return PostHogMiddleware(req);
  }

  if (isWebhookPath(host)) {
    return IncomingWebhookMiddleware(req);
  }

  if (isCustomDomain(host || "")) {
    return DomainMiddleware(req);
  }

  if (
    !path.startsWith("/view/") &&
    !path.startsWith("/verify") &&
    !path.startsWith("/unsubscribe") &&
    !path.startsWith("/notification-preferences") &&
    !path.startsWith("/auth/email")
  ) {
    return AppMiddleware(req);
  }

  return NextResponse.next();
}
