import { useTeam } from "@/context/team-context";
import useSWR from "swr";

import { DossierLimits } from "@/modules/access/limits";
import { fetcher } from "@/lib/utils";

export type LimitProps = DossierLimits;

export function useLimits() {
  const teamInfo = useTeam();
  const teamId = teamInfo?.currentTeam?.id;

  const { data, error } = useSWR<LimitProps | null>(
    teamId && `/api/teams/${teamId}/limits`,
    fetcher,
    {
      dedupingInterval: 30000,
    },
  );

  const limits = data ?? null;

  const documentLimit = limits?.documents ?? null;
  const canAddDocuments =
    documentLimit != null && documentLimit > 0
      ? (limits?.usage?.documents ?? 0) < documentLimit
      : true;
  const linkLimit = limits?.links ?? null;
  const canAddLinks =
    linkLimit != null && linkLimit > 0
      ? (limits?.usage?.links ?? 0) < linkLimit
      : true;
  const userLimit = limits?.users ?? null;
  const canAddUsers =
    userLimit != null && userLimit > 0
      ? (limits?.usage?.users ?? 0) < userLimit
      : true;

  return {
    showUpgradePlanModal: false,
    limits,
    canAddDocuments,
    canAddLinks,
    canAddUsers,
    isPaused: false,
    error,
    loading: !data && !error,
  };
}
