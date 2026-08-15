import { useTeam } from "@/features/workspace/providers/workspace-provider";
import useSWR from "swr";

import { TeamRole } from "@/shared/utils/types";
import { fetcher } from "@/shared/utils/utils";

export interface DataroomTeamMember {
  userId: string;
  name: string | null;
  email: string;
  role: TeamRole;
  status: "ACTIVE" | "BLOCKED_TRIAL_EXPIRED";
  /** True when access is scoped to specific rooms (DATAROOM_MEMBER). */
  scoped: boolean;
}

export interface DataroomTeamInvitation {
  email: string;
  expires: string;
}

interface DataroomMembersResponse {
  members: DataroomTeamMember[];
  invitations: DataroomTeamInvitation[];
}

/**
 * Internal team members with access to a single data room. `enabled` lets the
 * caller skip the request when the team isn't entitled to the feature.
 */
export function useDataroomMembers(
  dataroomId: string | undefined,
  enabled: boolean = true,
) {
  const { currentTeamId } = useTeam();

  const { data, error, isLoading, mutate } = useSWR<DataroomMembersResponse>(
    enabled && currentTeamId && dataroomId
      ? `/api/teams/${currentTeamId}/datarooms/${dataroomId}/members`
      : null,
    fetcher,
    { dedupingInterval: 10000 },
  );

  return {
    members: data?.members ?? [],
    invitations: data?.invitations ?? [],
    loading: isLoading,
    error,
    mutate,
  };
}
