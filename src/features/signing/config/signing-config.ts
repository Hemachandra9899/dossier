// Signing engine runtime configuration, resolved fail-closed.
//
// getSigningConfig() returns a typed, validated config for whichever engine is
// active. NATIVE needs no external credentials. DOCUMENSO requires
// SIGNING_API_KEY (and related host/url vars); it throws a SigningProviderError
// otherwise so callers fail loudly instead of falling back to placeholders.

import { SigningProviderError } from "../domain/signing-errors";
import {
  getDocumensoApiUrl,
  getDocumensoHost,
  getDocumensoWebhookSecret,
} from "../providers/documenso/client";
import {
  getActiveSigningProvider,
  isDossierSigningRuntimeEnabled,
  type SigningEngine,
} from "./index";

export interface SigningRuntimeConfig {
  engine: SigningEngine;
  // Present only when DOCUMENSO is active. Native flow reads nothing from here.
  host: string | null;
  apiUrl: string | null;
  apiKey: string | null;
  webhookSecret: string | null;
}

export function getSigningConfig(): SigningRuntimeConfig {
  if (!isDossierSigningRuntimeEnabled()) {
    throw new SigningProviderError(
      "Signing is not enabled for the current runtime.",
    );
  }

  const engine = getActiveSigningProvider();

  if (engine === "NATIVE") {
    return { engine, host: null, apiUrl: null, apiKey: null, webhookSecret: null };
  }

  const apiKey = process.env.SIGNING_API_KEY;
  if (!apiKey) {
    throw new SigningProviderError(
      "Signing provider is not configured. Set SIGNING_API_KEY to enable Documenso signing, or set SIGNING_PROVIDER=NATIVE to use Dossier native signing.",
    );
  }

  return {
    engine,
    host: getDocumensoHost(),
    apiUrl: getDocumensoApiUrl(),
    apiKey,
    webhookSecret: getDocumensoWebhookSecret(),
  };
}

/** True when the active engine needs the Documenso SDK/host at runtime. */
export function isDocumensoEngineActive(): boolean {
  return getActiveSigningProvider() === "DOCUMENSO";
}

export function requireSigningRuntimeEnabled(): void {
  if (!isDossierSigningRuntimeEnabled()) {
    throw new SigningProviderError(
      "Signing is not enabled for the current runtime.",
    );
  }
}

/** Documenso-only config with non-null credentials; throws if not configured. */
export interface DocumensoRuntimeConfig {
  engine: "DOCUMENSO";
  host: string;
  apiUrl: string;
  apiKey: string;
  webhookSecret: string | null;
}

export function requireDocumensoConfig(): DocumensoRuntimeConfig {
  const config = getSigningConfig();
  if (config.engine !== "DOCUMENSO" || !config.apiUrl || !config.apiKey) {
    throw new SigningProviderError(
      "Documenso signing is not active. Set SIGNING_PROVIDER=DOCUMENSO and SIGNING_API_KEY to use the Documenso engine.",
    );
  }
  return {
    engine: "DOCUMENSO",
    host: config.host ?? getDocumensoHost(),
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    webhookSecret: config.webhookSecret,
  };
}
