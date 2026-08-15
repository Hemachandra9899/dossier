"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { FileCard } from "./FileCard";
import { FILE_STATUSES, FILE_STATUS_LABEL } from "../file-status";
import { groupFilesByStatus } from "../file-status";

export function FileBoard({
  teamId,
}: {
  teamId: string;
}) {
  const boardQuery = useQuery({
    queryKey: ["files", teamId, "board"],
    queryFn: async () => {
      return { files: [] };
    },
    enabled: Boolean(teamId),
    staleTime: 15_000,
  });

  if (boardQuery.isPending) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  if (boardQuery.isError) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Error loading files.</p>
        <button
          onClick={() => boardQuery.refetch()}
          className="mt-2 btn btn-sm btn-primary">
          Retry
        </button>
      </div>
    );
  }

  // Group files by status client-side.
  const groups = useMemo(
    () => groupFilesByStatus(boardQuery.data?.files ?? []),
    [boardQuery.data?.files],
  );

  return (
    <div className="flex min-w-0 gap-4 overflow-x-auto pb-4">
      {FILE_STATUSES.map((status) => (
        <div
          key={status}
          className="min-h-[300px] w-full rounded-xl border bg-background p-6"
          aria-label={`Files ${FILE_STATUS_LABEL[status]} column`}
        >
          <h3 className="text-sm font-medium text-muted-foreground">
            {FILE_STATUS_LABEL[status]}
          </h3>
          {groups[status]?.length > 0 && (
            <FileCard
              key={status}
              file={groups[status][0]}
            />
          )}

          {groups[status]?.length === 0 && (
            <p className="text-xs text-muted-foreground mt-4">
              No client files
            </p>
          )}
        </div>
      ))}
    </div>
  );
}