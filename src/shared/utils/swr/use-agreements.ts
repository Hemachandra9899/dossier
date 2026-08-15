import { useTeam } from "@/features/workspace/providers/workspace-provider";
import { Agreement } from "@prisma/client";
import useSWR from "swr";

import { fetcher } from "@/shared/utils/utils";

export interface AgreementWithLinksCount extends Agreement {
  _count: {
    links: number;
    responses: number;
  };
}

export function useAgreements() {
  const teamInfo = useTeam();
  const teamId = teamInfo?.currentTeam?.id;

  const { data: agreements, error } = useSWR<AgreementWithLinksCount[]>(
    teamId && `/api/teams/${teamId}/agreements`,
    fetcher,
    {
      dedupingInterval: 60000,
    },
  );

  return {
    agreements: agreements || [],
    loading: !agreements && !error,
    error,
  };
}
