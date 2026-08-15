export function canCreatePremiumTeam(_params: any) { return true; }
export const PREMIUM_TEAM_LIMIT = 5;
export function getPremiumTeamEligibility(_params: any) {
  return { isPremiumAdmin: true, canCreate: true } as any;
}
