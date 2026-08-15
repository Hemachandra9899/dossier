import { useTeam } from "@/features/workspace/providers/workspace-provider";
import useSWR from "swr";

import AppLayout from "@/shared/ui/layouts/app";
import LoadingSpinner from "@/shared/ui/loading-spinner";
import { Button } from "@/shared/ui/button";
import { FilesBoard } from "@/shared/ui/files/files-board";
import { filesApi } from "@/features/files/ui/files-api";
import { CreateFileDialog } from "@/shared/ui/files/create-file-dialog";

export default function FilesPage() {
  const team = useTeam();
  const teamId = team?.currentTeam?.id;

  const { data, mutate, isLoading } = useSWR(
    teamId ? ["dossier-files", teamId] : null,
    ([, id]) => filesApi.list(id),
  );

  return (
    <AppLayout>
      <main className="mx-4 my-6 min-w-0 md:mx-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-800 dark:text-neutral-100">
              Files
            </h1>
            <p className="text-sm text-muted-foreground">
              Move every client file from incomplete to complete.
            </p>
          </div>

          <Button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("dossier:create-file"),
              );
            }}
          >
            New File
          </Button>
        </header>

        {!teamId || isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : (
          <FilesBoard
            files={data?.files ?? []}
            onMutate={() => mutate()}
          />
        )}

        <CreateFileDialog onCreated={() => mutate()} />
      </main>
    </AppLayout>
  );
}
