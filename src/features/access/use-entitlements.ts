import { useMemo } from "react";
import { DEFAULT_DOSSIER_ENTITLEMENTS, DossierEntitlements } from "./entitlements";

export function useEntitlements(): {
  entitlements: DossierEntitlements;
  loading: boolean;
  hasFeature: (feature: keyof DossierEntitlements) => boolean;
  checkEntitlement: (feature: keyof DossierEntitlements) => boolean;
} {
  const entitlements = useMemo(
    () => DEFAULT_DOSSIER_ENTITLEMENTS,
    [],
  );

  return {
    entitlements,
    loading: false,
    hasFeature: (feature: keyof DossierEntitlements) => entitlements[feature] ?? true,
    checkEntitlement: (feature: keyof DossierEntitlements) => entitlements[feature] ?? true,
  };
}
