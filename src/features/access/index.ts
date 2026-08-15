export * from "./is-team-paused";
export * from "./team-plan-custom-messaging";
export * from "./limits";

export function useEntitlements() {
  return { hasFeature: () => true, checkEntitlement: () => true };
}
