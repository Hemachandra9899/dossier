export const PREMIUM_TEAM_LIMIT = 100;

export async function getPremiumTeamEligibility(userId: string) {
  return {
    isPremiumAdmin: false,
    canCreate: true,
  };
}
