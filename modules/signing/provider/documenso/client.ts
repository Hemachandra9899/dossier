// Documenso SDK client factory. This file is the ONLY place in the application
// that imports @documenso/sdk-typescript. Legacy code imports the same
// functions through lib/signing/client.ts, which re-exports these.

import { Documenso } from "@documenso/sdk-typescript";

import { TeamError } from "@/lib/errorHandler";

const DEFAULT_SIGNING_HOST = "https://app.documenso.com";

const stripTrailingSlash = (value: string) => value.replace(/\/$/, "");

export const getDocumensoHost = () => {
  return stripTrailingSlash(
    process.env.NEXT_PUBLIC_SIGNING_HOST || DEFAULT_SIGNING_HOST,
  );
};

export const getDocumensoApiUrl = () => {
  return stripTrailingSlash(
    process.env.SIGNING_API_URL || `${getDocumensoHost()}/api/v2`,
  );
};

export const getDocumensoWebhookSecret = (): string | null => {
  return process.env.SIGNING_WEBHOOK_SECRET ?? null;
};

let documensoClient: Documenso | null = null;

export const getDocumensoClient = () => {
  const apiKey = process.env.SIGNING_API_KEY;

  if (!apiKey) {
    throw new TeamError("SIGNING_API_KEY environment variable is not set.");
  }

  if (!documensoClient) {
    documensoClient = new Documenso({
      apiKey,
      serverURL: getDocumensoApiUrl(),
      timeoutMs: 30_000,
    });
  }

  return documensoClient;
};
