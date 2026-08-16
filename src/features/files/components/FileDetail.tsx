"use client";

import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { toast } from "sonner";
import { useTeam } from "@/features/workspace/providers/workspace-provider";
import AppLayout from "@/shared/ui/layouts/app";
import LoadingSpinner from "@/shared/ui/loading-spinner";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";

import { fileDetailQuery } from "@/features/files/api/files.queries";
import { filesApi } from "@/features/files/api/files.api";

import { FileHeader } from "@/features/files/components/detail/FileHeader";
import { FileTabs } from "@/features/files/components/detail/FileTabs";
import { FileTabContent } from "@/features/files/components/detail/FileTabContent";

const VALID_TABS = [
  "overview",
  "requirements",
  "documents",
  "signatures",
  "activity",
  "completion",
] as const;

type FileTab = (typeof VALID_TABS)[number];

function getFileTab(value: unknown): FileTab {
  return VALID_TABS.includes(value as FileTab)
    ? (value as FileTab)
    : "overview"
}

export function FileDetailPage() {
  const router = useRouter();
  const team = useTeam();

  const teamId = team?.currentTeam?.id;

  const fileId =
    typeof router.query.fileId === "string"
      ? router.query.fileId
      : "";

  // Hooks must be called at the top level — before any early returns.
  const tab = useMemo(() => getFileTab(router.query.tab), [router.query.tab]);

  const fileQuery = useQuery(
    fileDetailQuery(teamId ?? "", fileId)
  );

  if (fileQuery.isPending) {
    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <LoadingSpinner className="h-10 w-10" />
        </div>
      </AppLayout>
    );
  }

  if (fileQuery.isError) {
    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Badge variant="outline" className="text-red-600">
            Could not load this file.
          </Badge>
        </div>
      </AppLayout>
    );
  }

  const file = fileQuery.data;

  if (!file) {
    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Badge variant="outline" className="text-red-600">
            File not found.
          </Badge>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="mx-4 my-6 min-w-0 md:mx-8 space-y-6">
        <FileDetail
          file={file}
          tab={tab}
          teamId={teamId ?? ""}
          onTabChange={(next) =>
            router.push(
              {
                pathname: router.pathname,
                query: {
                  ...router.query,
                  tab: next,
                },
              },
              undefined,
              { shallow: true },
            )
          }
        />
      </main>
    </AppLayout>
  );
}

function FileDetail({
  file,
  tab,
  teamId,
  onTabChange,
}: {
  file: any;
  tab: FileTab;
  teamId: string;
  onTabChange: (next: FileTab) => void;
}) {
  return (
    <div className="space-y-6">
      <FileHeader file={file} />

      <FileTabs
        value={tab}
        onChange={(next) => onTabChange(next as FileTab)}
      />

      <FileTabContent
        tab={tab}
        file={file}
        teamId={teamId}
      />
    </div>
  );
}

