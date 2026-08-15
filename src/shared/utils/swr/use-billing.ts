import { useMemo } from "react";

// DEPRECATED: billing is being removed. This hook is a transitional stub that
// reports every workspace as fully entitled so no feature ever falls back to a
// "free" tier. New code must use `useEntitlements` / `useLimits` instead.
// TODO: delete this module and migrate remaining call sites.

type PlanResponse = {
  plan: string;
  startsAt: Date | null;
  endsAt: Date | null;
  pausedAt: Date | null;
  pauseStartsAt: Date | null;
  pauseEndsAt: Date | null;
  isPaused: boolean;
  cancelledAt: Date | null;
  trialEndsAt: Date | null;
  isCustomer: boolean;
  subscriptionCycle: "monthly" | "yearly";
  discount: null;
};

const UNLOCKED_PLAN: PlanResponse = {
  plan: "business",
  startsAt: null,
  endsAt: null,
  pausedAt: null,
  pauseStartsAt: null,
  pauseEndsAt: null,
  isPaused: false,
  cancelledAt: null,
  trialEndsAt: null,
  isCustomer: true,
  subscriptionCycle: "monthly",
  discount: null,
};

export function usePlan({
  withDiscount = false,
}: { withDiscount?: boolean } = {}) {
  void withDiscount;
  const plan = useMemo(() => UNLOCKED_PLAN, []);

  return {
    plan: plan.plan,
    planName: "Business",
    originalPlan: plan.plan,
    trial: null,
    isTrial: false,
    isOldAccount: false,
    isCustomer: true,
    isAnnualPlan: true,
    startsAt: null,
    endsAt: null,
    cancelledAt: null,
    trialEndsAt: null,
    pausedAt: null,
    isPaused: false,
    isCancelled: false,
    pauseStartsAt: null,
    pauseEndsAt: null,
    discount: null,
    isFree: false,
    isStarter: false,
    isPro: true,
    isBusiness: true,
    isDatarooms: true,
    isDataroomsPlus: true,
    isDataroomsPremium: true,
    isDataroomsUnlimited: true,
    loading: false,
    error: undefined,
    mutate: () => {},
  };
}
