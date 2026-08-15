export function isDossierSigningRuntimeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DOSSIER_SIGNING === "true" || process.env.NODE_ENV === "test";
}

export const isDossierSigningEnabled = isDossierSigningRuntimeEnabled;
