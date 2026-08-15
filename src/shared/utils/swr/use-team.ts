import { useTeam } from "@/features/workspace/providers/workspace-provider";
import useSWR from "swr";

import { TeamDetail } from "@/shared/utils/types";
import { fetcher } from "@/shared/utils/utils";

export function useGetTeam() {
  const { currentTeamId } = useTeam();

  const { data: team, error } = useSWR<TeamDetail>(
    currentTeamId && `/api/teams/${currentTeamId}`,
    fetcher,
    {
      dedupingInterval: 20000,
    },
  );

  return {
    team,
    loading: team ? false : true,
    error,
  };
}
