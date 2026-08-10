// GetPublicSignedArtifact: recipient-facing access to the mirrored signed
// PDF. Scoped by requestId only. Returns a presigned download URL when the
// artifact has been mirrored, otherwise "pending".

import { DocumentStorageType } from "@prisma/client";

import { getFile } from "@/lib/files/get-file";

import type { SigningContext } from "./context";
import { SigningNotFoundError } from "../domain/signing-errors";

export interface PublicSignedArtifactDTO {
  status: "pending" | "completed";
  downloadUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export interface GetPublicSignedArtifactInput {
  requestId: string;
}

export async function getPublicSignedArtifact(
  ctx: SigningContext,
  input: GetPublicSignedArtifactInput,
): Promise<PublicSignedArtifactDTO> {
  const request = await ctx.requests.findById(input.requestId);
  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  const artifact = await ctx.requests.findArtifactByRequestId(input.requestId);
  if (!artifact) {
    return { status: "pending" };
  }

  const downloadUrl = await getFile({
    type: DocumentStorageType.S3_PATH,
    data: artifact.storageKey,
    isDownload: true,
    expiresIn: 60_000,
    responseContentDisposition: `attachment; filename="${artifact.fileName}"`,
  });

  return {
    status: "completed",
    downloadUrl,
    fileName: artifact.fileName,
    mimeType: artifact.mimeType,
  };
}
