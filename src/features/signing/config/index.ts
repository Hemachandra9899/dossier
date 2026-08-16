export function isDossierSigningRuntimeEnabled(): boolean {
  return (
    process.env.DOSSIER_SIGNING_RUNTIME_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_DOSSIER_SIGNING_RUNTIME_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_DOSSIER_SIGNING === "true" ||
    process.env.NODE_ENV === "test"
  );
}

export const isDossierSigningEnabled = isDossierSigningRuntimeEnabled();

/**
 * The signing engine Dossier uses to execute envelopes. NATIVE owns the whole
 * lifecycle inside Dossier (no external API key required); DOCUMENSO delegates
 * envelope creation/distribution/signing to the Documenso API.
 *
 * Defaults to NATIVE so Dossier signing works without SIGNING_API_KEY. Set
 * SIGNING_PROVIDER=DOCUMENSO to opt a runtime back onto the legacy provider.
 */
export type SigningEngine = "NATIVE" | "DOCUMENSO";

export function getActiveSigningProvider(): SigningEngine {
  const raw = (process.env.SIGNING_PROVIDER ?? "NATIVE").trim().toUpperCase();
  return raw === "DOCUMENSO" ? "DOCUMENSO" : "NATIVE";
}

export const activeSigningProvider = getActiveSigningProvider();

export function isNativeSigningProvider(): boolean {
  return getActiveSigningProvider() === "NATIVE";
}

/** Whether the client-side "Request signature" creation UI is enabled. */
export function isDossierSigningCreationEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_DOSSIER_SIGNING_CREATION_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_DOSSIER_SIGNING === "true" ||
    process.env.NODE_ENV === "test"
  );
}

export const isDossierSigningCreationFlagEnabled =
  isDossierSigningCreationEnabled();
