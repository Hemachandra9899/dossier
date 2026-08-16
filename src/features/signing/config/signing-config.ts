// Signing provider runtime configuration, resolved fail-closed.
//
// The envelope flow (createEnvelope -> distributeEnvelope -> recipient signing)
// must never silently degrade to a no-op. getSigningConfig() returns a typed,
// validated config when the runtime is enabled and the provider is configured,
// and throws a SigningProviderError otherwise so callers fail loudly instead of
// falling back to local/test placeholders.

import { SigningProviderError } from "../domain/signing-errors";
import {
  getDocumensoApiUrl,
  getDocumensoHost,
  getDocumensoWebhookSecret,
} from "../providers/documenso/client";
import { isDossierSigningRuntimeEnabled } from "./index";

export interface SigningRuntimeConfig {
  provider: "DOCUMENSO";
  host: string;
  apiUrl: string;
  apiKey: string;
  webhookSecret: string | null;
}

export function getSigningConfig(): SigningRuntimeConfig {
  if (!isDossierSigningRuntimeEnabled()) {
    throw new SigningProviderError(
      "Signing is not enabled for the current runtime.",
    );
  }

  const apiKey = process.env.SIGNING_API_KEY;
  if (!apiKey) {
    throw new SigningProviderError(
      "Signing provider is not configured. Set SIGNING_API_KEY to enable Dossier signing.",
    );
  }

  return {
    provider: "DOCUMENSO",
    host: getDocumensoHost(),
    apiUrl: getDocumensoApiUrl(),
    apiKey,
    webhookSecret: getDocumensoWebhookSecret(),
  };
}
