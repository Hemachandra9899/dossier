import { useTeam } from "@/features/workspace/providers/workspace-provider";
import { Invitation } from "@prisma/client";
import useSWR from "swr";

import { fetcher } from "@/shared/utils/utils";

export function useInvitations() {
  const teamInfo = useTeam();

  // only fetch data once when linkId is present
  const { data: invitations, error } = useSWR<Invitation[]>(
    teamInfo?.currentTeam &&
      `/api/teams/${teamInfo.currentTeam.id}/invitations`,
    fetcher,
    {
      dedupingInterval: 10000,
    },
  );

  return {
    invitations,
    loading: !error && !invitations,
    error,
  };
}
