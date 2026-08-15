import { useTeam } from "@/features/workspace/providers/workspace-provider";
import useSWR from "swr";

import { DocumentPreviewData } from "@/shared/utils/types/document-preview";
import { fetcher } from "@/shared/utils/utils";

export function useDocumentPreview(documentId: string, isOpen: boolean) {
  const { currentTeamId } = useTeam();

  const {
    data: document,
    error,
    mutate,
  } = useSWR<DocumentPreviewData>(
    isOpen && currentTeamId && documentId
      ? `/api/teams/${currentTeamId}/documents/${documentId}/preview-data`
      : null,
    fetcher,
    {
      dedupingInterval: 10000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateOnMount: true,
      revalidateIfStale: true,
    },
  );

  return {
    document,
    loading: !error && !document && isOpen,
    error,
    mutate,
  };
}
