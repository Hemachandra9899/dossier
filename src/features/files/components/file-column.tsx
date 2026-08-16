"use client";

import React from "react";

import { FILE_STATUSES, FILE_STATUS_LABEL } from "../file-status";
import { FileCard } from "./FileCard";

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
  // Filter files by status directly - this lets TypeScript infer any[]
  const columnFiles = (files ?? []).filter((f: any) => f.status === status);

  return (
    <div
      className="min-h-[300px] w-full rounded-xl border bg-background p-6"
      aria-label={`Files ${FILE_STATUS_LABEL[status]} column`}
    >
      {columnFiles.length > 0 && (
        <FileCard
          key={columnFiles[0].id}
          file={columnFiles[0]}
          onMove={onMove}
          teamId={teamId}
        />
      )}

      {columnFiles.length === 0 && (
        <p className="text-xs text-muted-foreground mt-4">
          No client files
        </p>
      )}
    </div>
  );
}