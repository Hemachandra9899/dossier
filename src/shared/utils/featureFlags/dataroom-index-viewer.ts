import { teamPlanIsDataroomPlusTier } from "@/features/access/team-plan-custom-messaging";

import { getFeatureFlags } from "@/shared/utils/featureFlags";

/**
 * Visitor-facing hierarchical numbering (prefixes in breadcrumb, cards, tree).
 * Matches rebuild-index eligibility: Edge Config `dataroomIndex` OR Plus-tier plan.
 */
export async function resolveDataroomIndexEnabledForViewer(opts: {
  teamId: string | null | undefined;
  teamPlan: string | null | undefined;
}): Promise<boolean> {
  const flags = await getFeatureFlags({ teamId: opts.teamId || undefined });
  return Boolean(
    flags.dataroomIndex ||
      teamPlanIsDataroomPlusTier(opts.teamPlan ?? undefined),
  );
}
