/**
 * DEPRECATED: billing plans are removed. Every workspace is entitled to all
 * features, so these plan-gate helpers are kept as always-true shims for
 * transitional call sites. TODO: remove once call sites are migrated to
 * `useEntitlements`.
 */

export function teamPlanAllowsCustomWelcomeAndCta(
  plan: string | null | undefined,
): boolean {
  void plan;
  return true;
}

export function teamPlanIsDataroomPlusTier(
  plan: string | null | undefined,
): boolean {
  void plan;
  return true;
}

export function teamPlanAllowsLayoutCustomization(
  plan: string | null | undefined,
): boolean {
  void plan;
  return true;
}

export function teamPlanAllowsVisitorLanguage(
  plan: string | null | undefined,
): boolean {
  void plan;
  return true;
}

export function teamPlanShowsLayoutUi(
  plan: string | null | undefined,
): boolean {
  void plan;
  return true;
}
