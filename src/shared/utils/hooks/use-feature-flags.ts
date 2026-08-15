import { useTeam } from "@/features/workspace/providers/workspace-provider";
import useSWR from "swr";

import { BetaFeatures } from "@/shared/utils/featureFlags";
import { fetcher } from "@/shared/utils/utils";

/**
 * Hook to fetch and use feature flags for the current team
 */
export function useFeatureFlags() {
  const teamInfo = useTeam();

  const {
    data: features,
    error,
    isLoading,
  } = useSWR<Record<BetaFeatures, boolean>>(
    teamInfo?.currentTeam?.id
      ? `/api/feature-flags?teamId=${teamInfo.currentTeam.id}`
      : null,
    fetcher,
  );

  return {
    features,
    isLoading,
    error,
    // Helper function to check if a specific feature is enabled
    isFeatureEnabled: (feature: BetaFeatures) => features?.[feature] || false,
  };
}
