// Feature flags for the Dossier signing capability. Split into two knobs so a
// rollout can disable sender-side creation without invalidating recipient
// links that have already been distributed:
//
//   NEXT_PUBLIC_DOSSIER_SIGNING_CREATION_ENABLED  sender UI + sender APIs
//   NEXT_PUBLIC_DOSSIER_SIGNING_RUNTIME_ENABLED   public recipient endpoints,
//                                                 signing sessions, webhooks
//
// Turning OFF creation leaves existing signature requests fully usable
// (recipients can still open links, sign, and download the signed copy).
// Turning OFF runtime is a kill switch that strands in-flight requests.

export const isDossierSigningCreationEnabled =
  process.env.NEXT_PUBLIC_DOSSIER_SIGNING_CREATION_ENABLED === "true";

export const isDossierSigningRuntimeEnabled =
  process.env.NEXT_PUBLIC_DOSSIER_SIGNING_RUNTIME_ENABLED === "true";

/** Alias used by the sender-facing UI and APIs. */
export const isDossierSigningEnabled = isDossierSigningCreationEnabled;
