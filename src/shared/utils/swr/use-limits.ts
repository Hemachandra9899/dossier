export function useLimits() {
  return {
    data: { allowed: true },
    canAddUsers: true,
    showUpgradePlanModal: () => {},
    limits: { maxUsers: 100 },
  } as any;
}
export default useLimits;
