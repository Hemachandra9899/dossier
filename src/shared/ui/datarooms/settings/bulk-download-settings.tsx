import { useState } from "react";

import { useTeam } from "@/features/workspace/providers/workspace-provider";
import { toast } from "sonner";
import useSWR from "swr";

import { fetcher } from "@/shared/utils/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";

interface BulkDownloadSettingsProps {
  dataroomId: string;
}

export default function BulkDownloadSettings({
  dataroomId,
}: BulkDownloadSettingsProps) {
  const teamInfo = useTeam();
  const teamId = teamInfo?.currentTeam?.id;

  const { data: dataroomData, mutate: mutateDataroom } = useSWR<{
    id: string;
    name: string;
    pId: string;
    allowBulkDownload: boolean;
  }>(
    dataroomId ? `/api/teams/${teamId}/datarooms/${dataroomId}` : null,
    fetcher,
  );

  const [isUpdating, setIsUpdating] = useState(false);

  const handleBulkDownloadToggle = async (checked: boolean) => {
    if (!dataroomId || !teamId || isUpdating) return;

    setIsUpdating(true);

    toast.promise(
      fetch(`/api/teams/${teamId}/datarooms/${dataroomId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowBulkDownload: checked,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to update bulk download settings");
        }
        await mutateDataroom();
      }),
      {
        loading: "Updating bulk download settings...",
        success: "Bulk download settings updated successfully",
        error: "Failed to update bulk download settings",
      },
    );

    setIsUpdating(false);
  };

  return (
    <Card className="bg-transparent">
      <CardHeader>
        <CardTitle className="flex items-center">Dataroom Download</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label
              htmlFor="bulk-download-toggle"
              className="text-sm font-medium"
            >
              Allow bulk download of entire dataroom
            </Label>
          </div>
          <Switch
            id="bulk-download-toggle"
            checked={dataroomData?.allowBulkDownload ?? true}
            onCheckedChange={handleBulkDownloadToggle}
            disabled={isUpdating}
          />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between rounded-b-lg border-t bg-muted px-6 py-6">
        <p className="text-sm text-muted-foreground transition-colors">
          When enabled, visitors can download all dataroom contents as a single
          ZIP file. Individual document and folder downloads will still work
          regardless of this setting.
        </p>
      </CardFooter>
    </Card>
  );
}
