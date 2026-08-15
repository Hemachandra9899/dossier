import { useTeam } from "@/features/workspace/providers/workspace-provider";
import { View } from "@prisma/client";
import useSWR from "swr";

import { TStatsData } from "@/shared/utils/swr/use-stats";
import { fetcher } from "@/shared/utils/utils";

export function useDocumentStats(documentId: string | null | undefined) {
  const { currentTeamId: teamId } = useTeam();

  const { data: stats, error } = useSWR<TStatsData>(
    documentId && teamId
      ? `/api/teams/${teamId}/documents/${encodeURIComponent(documentId)}/stats`
      : null,
    fetcher,
    {
      dedupingInterval: 10000,
    },
  );

  return {
    stats,
    loading: documentId ? !error && !stats : false,
    error,
  };
}
