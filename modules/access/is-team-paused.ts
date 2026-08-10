import { Team } from "@prisma/client";

/**
 * Billing/subscription pausing is removed: teams are never paused.
 * Kept as an always-false helper so legacy call sites keep compiling as no-ops.
 */
export function isTeamPaused(
  team: Pick<Team, "pausedAt" | "pauseStartsAt" | "pauseEndsAt">,
): boolean {
  void team;
  return false;
}

export async function isTeamPausedById(teamId: string): Promise<boolean> {
  void teamId;
  return false;
}
