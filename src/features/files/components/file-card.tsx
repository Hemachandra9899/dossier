"use client";

import React from "react";
import { FILE_STATUSES, FILE_STATUS_LABEL } from "../file-status";

export function FileCard({
  file,
  onMove,
  teamId,
  isDragging,
}: {
  file: any;
  onMove: any;
  teamId: string;
  isDragging?: boolean;
}) {
  const statusIndex = FILE_STATUSES.indexOf(file.status as any);
  const statusLabel =
    statusIndex >= 0
      ? FILE_STATUS_LABEL[FILE_STATUSES[statusIndex as any]]
      : String(file.status);

  const diffMs = new Date(file.dueAt).getTime() - new Date().getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return (
    <div
      className={`rounded-lg border bg-card p-4 hover:bg-card-hover cursor-pointer transition-colors ${isDragging ? "opacity-50" : ""}`}
      draggable
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
          {file.clientName?.charAt(0) || "C"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate line-clamp-1">
            {file.title || "Untitled"}
          </p>
          <p className="text-xs text-muted-foreground truncate line-clamp-1">
            {file.clientName || "No client"}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-1">
        {statusLabel}
      </p>

      {file.dueAt && diffDays <= 0 && (
        <p className="text-xs text-danger mt-1">
          Overdue
        </p>
      )}

      {file.dueAt && diffDays === 1 && (
        <p className="text-xs text-muted-foreground mt-1">
          Due tomorrow
        </p>
      )}

      {file.dueAt && diffDays > 1 && (
        <p className="text-xs text-muted-foreground mt-1">
          Due in {diffDays} days
        </p>
      )}

      {file.requirements && (
        <p className="text-xs text-muted-foreground mt-1">
          {file.requirements.completed}/{file.requirements.total} requirements
        </p>
      )}

      {file.signing?.required && file.signing?.signed > 0 && (
        <p className="text-xs text-success mt-1">
          {file.signing.signed}/{file.signing.total} signed
        </p>
      )}
    </div>
  );
}