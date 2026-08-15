import { AbortTaskRunError, logger, task } from "@trigger.dev/sdk";

import { ONE_HOUR } from "@/shared/utils/constants";
import { isTrustedTeam } from "@/shared/utils/edge-config/trusted-teams";
import { getFile } from "@/shared/utils/files/get-file";
import prisma from "@/shared/utils/prisma";
import { convertPdfDirectTask } from "@/platform/queue/trigger/convert-pdf-direct";
import { updateStatus } from "@/shared/utils/utils/generate-trigger-status";

type ConvertPdfToImagePayload = {
  documentId: string;
  documentVersionId: string;
  teamId: string;
  versionNumber?: number;
};

/**
 * Converts a PDF into per-page images using the download-once direct task.
 *
 * The direct task downloads the source PDF a single time, opens one MuPDF
 * document, renders every page in-process, uploads each page asset and creates
 * the DocumentPage rows. It only sets `hasPages: true` once every page
 * exists, preserving the processing invariant:
 *
 *   upload → hasPages=false → convert → DocumentPage[] → hasPages=true
 *
 * This avoids the previous standard path, which re-downloaded and re-parsed
 * the entire source PDF once per page (20 MB × N pages).
 */
export const convertPdfToImageRoute = task({
  id: "convert-pdf-to-image-route",
  run: async (payload: ConvertPdfToImagePayload) => {
    const { documentVersionId, teamId, documentId, versionNumber } = payload;

    updateStatus({ progress: 0, text: "Initializing..." });

    // 1. get file url from document version
    const documentVersion = await prisma.documentVersion.findUnique({
      where: {
        id: documentVersionId,
      },
      select: {
        file: true,
        storageType: true,
        numPages: true,
      },
    });

    // if documentVersion is null, log error and abort
    if (!documentVersion) {
      logger.error("File not found", { payload });
      updateStatus({ progress: 0, text: "Document not found" });
      throw new AbortTaskRunError("Document version not found");
    }

    logger.info("Document version", { documentVersion });
    updateStatus({ progress: 10, text: "Retrieving file..." });

    // 2. get signed url from file with 1-hour expiration for long-running conversions
    const signedUrl = await getFile({
      type: documentVersion.storageType,
      data: documentVersion.file,
      expiresIn: ONE_HOUR,
    });

    logger.info("Retrieved signed url", { signedUrl });

    if (!signedUrl) {
      logger.error("Failed to get signed url", { payload });
      updateStatus({ progress: 0, text: "Failed to retrieve document" });
      throw new AbortTaskRunError("Failed to get signed URL for document");
    }

    // Check once if this team is trusted (skips keyword checks for all pages)
    const trustedTeam = await isTrustedTeam(teamId);

    // 3. Delegate to the download-once converter. It handles downloading the
    //    source, rendering every page, uploading assets, creating DocumentPage
    //    rows and finally setting hasPages=true on the version.
    const result = await convertPdfDirectTask.triggerAndWait({
      documentVersionId,
      teamId,
      documentId,
      signedUrl,
      trustedTeam,
      versionNumber,
    });

    if (result.ok) {
      updateStatus({ progress: 100, text: "Processing complete" });
      return result.output;
    }

    logger.error("Direct PDF conversion failed", { payload });
    updateStatus({ progress: 0, text: "Conversion failed" });
    throw new AbortTaskRunError("PDF conversion failed");
  },
});
