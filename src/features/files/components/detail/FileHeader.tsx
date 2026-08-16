"use client";

import { Badge } from "@/shared/ui/badge";
import { fileStatusLabels } from "../../file-status";

export function FileHeader({
  file,
}: {
  file: any;
}) {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{file.priority}</Badge>
          <Badge className="capitalize">
            {fileStatusLabels[file.status as keyof typeof fileStatusLabels].toLowerCase().replace(/_/g, " ")}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-800 dark:text-neutral-100 mt-2">
          {file.clientName || file.title}
        </h1>
        {file.clientName && (
          <p className="text-sm text-muted-foreground">{file.title}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {fileStatusLabels[file.status as keyof typeof fileStatusLabels].toLowerCase().replace(/_/g, " ")}
        </Badge>
      </div>
    </header>
  );
}