import { tasks } from "@trigger.dev/sdk";

import type { convertFilesToPdfTask } from "@/ee/features/conversions/lib/trigger/convert-files";
import { processVideo } from "@/platform/queue/trigger/optimize-video-files";
import { convertPdfToImageRoute } from "@/platform/queue/trigger/pdf-to-image-route";
import { isMarkdownFile } from "@/shared/utils/utils/get-content-type";
import { conversionQueueName } from "@/shared/utils/utils/trigger-utils";

export interface TriggerDocumentProcessingParams {
  teamId: string;
  documentId: string;
  documentVersionId: string;
  versionNumber: number;
  type?: string | null;
  plan?: string | null;
  url?: string;
  contentType?: string | null;
  fileSize?: number;
}

/**
 * Enqueue the conversion task appropriate for a freshly created document
 * version. This is the only place that decides *which* task runs; the actual
 * tasks themselves are responsible for setting `hasPages: true` once every
 * DocumentPage row exists.
 *
 * Mirrors the logic used by the new-version endpoint so initial uploads and
 * version uploads behave identically.
 */
export async function triggerDocumentProcessing({
  teamId,
  documentId,
  documentVersionId,
  versionNumber,
  type,
  plan,
  url,
  contentType,
  fileSize,
}: TriggerDocumentProcessingParams): Promise<void> {
  if (!type) return;

  const options = {
    idempotencyKey: `${teamId}-${documentVersionId}`,
    tags: [
      `team_${teamId}`,
      `document_${documentId}`,
      `version:${documentVersionId}`,
    ],
    queue: conversionQueueName(plan ?? "free"),
    concurrencyKey: teamId,
  };

  const isDownloadOnlyByExtension =
    /\.(log|err|prj|jgw|tif|tiff|ecw|bak)$/i.test(url ?? "");

  const isMarkdown = isMarkdownFile({ name: url ?? "", contentType });

  if (
    (type === "docs" || type === "slides") &&
    !isDownloadOnlyByExtension &&
    !isMarkdown
  ) {
    await tasks.trigger<typeof convertFilesToPdfTask>(
      "convert-files-to-pdf",
      {
        documentVersionId,
        teamId,
        documentId,
      },
      options,
    );
  }

  if (
    type === "video" &&
    contentType &&
    contentType !== "video/mp4" &&
    contentType.startsWith("video/")
  ) {
    await processVideo.trigger(
      {
        videoUrl: url ?? "",
        teamId,
        docId: (url ?? "").split("/")[1],
        documentVersionId,
        fileSize: fileSize || 0,
      },
      {
        ...options,
        idempotencyKey: `${teamId}-${documentVersionId}`,
      },
    );
  }

  if (type === "pdf") {
    await convertPdfToImageRoute.trigger(
      {
        documentId,
        documentVersionId,
        teamId,
        versionNumber,
      },
      options,
    );
  }
}
