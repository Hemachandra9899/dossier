"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { filesApi } from "@/features/files/api/files.api";

export function FileTabContent({
  tab,
  file,
  teamId,
}: {
  tab: "overview" | "requirements" | "documents" | "signatures" | "activity" | "completion";
  file: any;
  teamId: string;
}) {
  switch (tab) {
    case "overview":
      return <FileOverview file={file} />;

    case "requirements":
      return (
        <div className="space-y-6">
          <h3 className="font-semibold text-sm text-neutral-800">Checklist & Requests</h3>
          <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg bg-neutral-50">
            Requirements feature takes over this tab. Real query will be wired when the Requirements feature is integrated.
          </p>
        </div>
      );

    case "documents":
      return (
        <div className="space-y-6">
          <h3 className="font-semibold text-sm text-neutral-800">Files & Documents</h3>
          <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg bg-neutral-50">
            Documents feature takes over this tab. Real query will be wired when the Documents feature is integrated.
          </p>
        </div>
      );

    case "signatures":
      return (
        <div className="space-y-6">
          <h3 className="font-semibold text-sm text-neutral-800">Linked Signature Envelopes</h3>
          <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg bg-neutral-50">
            Signing feature reuses existing data. Real query will be wired when the Signing feature is integrated.
          </p>
        </div>
      );

    case "activity":
      return (
        <div className="space-y-6">
          <h3 className="font-semibold text-sm text-neutral-800">Unified Timeline</h3>
          <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg bg-neutral-50">
            Activity feature owns merged timeline. Real query will be wired when the Activity feature is integrated.
          </p>
        </div>
      );

    case "completion":
      return (
        <div className="space-y-6">
          <h3 className="font-semibold text-sm text-neutral-800">Completion Status</h3>
          <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg bg-neutral-50">
            Completion feature owns readiness query. Real query will be wired when the Completion feature is integrated.
          </p>
        </div>
      );
  }
}

function FileOverview({
  file,
}: {
  file: any;
}) {
  const [requirements, setRequirements] = React.useState({
    total: file?.requirementsTaskList?.tasks?.length ?? 0,
    completed: file?.requirementsTaskList?.tasks?.filter(
      (t: any) => t.status === "COMPLETED",
    ).length ?? 0,
  });

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="space-y-6 md:col-span-2">
        <div className="bg-background rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm text-neutral-500 uppercase tracking-wider">File Context</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">Client Email</span>
              <span className="font-medium">{file.clientEmail || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Case Type</span>
              <span className="font-medium">{file.caseType || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Reference ID</span>
              <span className="font-medium">{file.reference || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Due Date</span>
              <span className="font-medium">
                {file.dueAt ? new Date(file.dueAt).toLocaleDateString() : "No due date"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-neutral-800">Internal Notes</h3>
          <p className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-lg bg-neutral-50">
            No internal notes yet.
          </p>
        </div>
      </div>

      <div className="bg-background rounded-xl border p-5 space-y-4 h-fit">
        <h3 className="font-semibold text-sm text-neutral-800">Completion Summary</h3>
        <div className="text-3xl font-extrabold tracking-tight">
          {requirements.completed} / {requirements.total}
        </div>
        <p className="text-xs text-muted-foreground">
          Requirements approved by coordinators.
        </p>
      </div>
    </div>
  );
}