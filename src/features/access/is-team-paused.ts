export async function isTeamPaused(_teamId: string): Promise<boolean> {
  return false;
}

export const isTeamPausedById = isTeamPaused;

export async function assertTeamNotPaused(teamId: string): Promise<void> {
  const paused = await isTeamPaused(teamId);
  if (paused) {
    throw new Error("Team subscription is currently paused.");
  }
}
