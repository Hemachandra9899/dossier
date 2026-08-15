"use client";

import React, { useMemo } from "react";

import { FILE_STATUSES, FILE_STATUS_LABEL, groupFilesByStatus } from "../file-status";

export function FileColumn({
  status,
  files,
  onMove,
  teamId,
}: {
  status: (typeof FILE_STATUSES)[number];
  files: any[];
  onMove: any;
  teamId: string;
}) {
  const columnFiles = useMemo(
    () => groupFilesByStatus(files ?? []),
    [files],
  );

  return (
    <div
      className="min-h-[300px] w-full rounded-xl border bg-background p-6"
      aria-label={`Files ${FILE_STATUS_LABEL[status]} column`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {FILE_STATUS_LABEL[status]}
        </h3>
      </div>

      {columnFiles.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          onMove={onMove}
          teamId={teamId}
        />
      ))}

      {columnFiles.length === 0 && (
        <p className="text-xs text-muted-foreground mt-4">
          No client files
        </p>
      )}
    </div>
  );
}