export function isDossierSigningRuntimeEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_DOSSIER_SIGNING_RUNTIME_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_DOSSIER_SIGNING === "true" ||
    process.env.NODE_ENV === "test"
  );
}

export const isDossierSigningEnabled = isDossierSigningRuntimeEnabled();
