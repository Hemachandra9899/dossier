export function canUseCustomMessaging(_teamId: string): boolean {
  return true;
}

export const teamPlanAllowsCustomWelcomeAndCta = canUseCustomMessaging;
export const teamPlanAllowsLayoutCustomization = canUseCustomMessaging;
export const teamPlanAllowsVisitorLanguage = canUseCustomMessaging;
export const teamPlanIsDataroomPlusTier = canUseCustomMessaging;
