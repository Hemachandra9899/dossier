import { useMemo } from "react";

import { DEFAULT_DOSSIER_ENTITLEMENTS, DossierEntitlements } from "./entitlements";

// Every workspace is fully entitled. Kept as a hook so future entitlement
// sources (e.g. flags) can be swapped in without touching call sites.
export function useEntitlements(): {
  entitlements: DossierEntitlements;
  loading: boolean;
} {
  const entitlements = useMemo(
    () => DEFAULT_DOSSIER_ENTITLEMENTS,
    [],
  );

  return { entitlements, loading: false };
}
