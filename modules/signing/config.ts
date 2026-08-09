// Feature flag for the Dossier signing capability. Until the new
// SignatureRequest flow is proven end-to-end, everything it introduces is
// gated behind this flag and the legacy Agreement signing flow stays live.

export const isDossierSigningEnabled =
  process.env.NEXT_PUBLIC_DOSSIER_SIGNING_ENABLED === "true";
