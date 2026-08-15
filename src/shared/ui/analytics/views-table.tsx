import React from "react";
import { Eye, Clock } from "lucide-react";

export function ViewsTable({
  startDate,
  endDate,
}: {
  startDate?: Date;
  endDate?: Date;
}) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
          <Eye className="h-6 w-6" />
        </div>
        <h4 className="text-base font-semibold text-foreground">Recent View Logs</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
          Real-time stream of page turns, completion events, and time spent on your dossiers.
        </p>
      </div>
    </div>
  );
}

export default ViewsTable;
