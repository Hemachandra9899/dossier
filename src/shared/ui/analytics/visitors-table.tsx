import React from "react";
import Link from "next/link";
import { Users, UserCheck } from "lucide-react";

export function VisitorsTable({
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
          <Users className="h-6 w-6" />
        </div>
        <h4 className="text-base font-semibold text-foreground">Visitor Profiles</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
          Identified viewers, authenticated domain visits, and session timelines will appear here.
        </p>
        <Link
          href="/visitors"
          className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-all"
        >
          <UserCheck className="h-4 w-4" />
          View All Visitors
        </Link>
      </div>
    </div>
  );
}

export default VisitorsTable;
