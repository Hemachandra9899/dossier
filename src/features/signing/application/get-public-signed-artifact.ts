// GetPublicSignedArtifact: access-proofed, recipient-safe access to the
// mirrored signed PDF. Only a verified recipient on a COMPLETED request may
// obtain the short-lived presigned download URL; anything else yields a state
// error or "pending" while the mirror is still running. Never returns the
// storage key, bucket or any internal storage metadata.

import { DocumentStorageType } from "@prisma/client";

import { getFile } from "@/shared/utils/files/get-file";

import type { SigningContext } from "./context";
import {
  SigningNotFoundError,
  SigningStateError,
} from "../domain/signing-errors";

export interface PublicSignedArtifactDTO {
  status: "pending" | "completed";
  downloadUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export interface GetPublicSignedArtifactInput {
  requestId: string;
  recipientId: string;
}

const PRESIGNED_URL_TTL_MS = 300_000;

export async function getPublicSignedArtifact(
  ctx: SigningContext,
  input: GetPublicSignedArtifactInput,
): Promise<PublicSignedArtifactDTO> {
  const request = await ctx.requests.findByIdWithRecipients(input.requestId);
  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  // Only the recipient bound to the access token may download.
  const recipient = request.recipients.find(
    (item: any) => item.id === input.recipientId,
  );
  if (!recipient) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  if (request.status !== "COMPLETED") {
    throw new SigningStateError(
      "The signed copy is available once the request is completed.",
    );
  }

  const artifact = await ctx.requests.findArtifactByRequestId(input.requestId);
  if (!artifact) {
    return { status: "pending" };
  }

  const downloadUrl = await getFile({
    type: DocumentStorageType.S3_PATH,
    data: artifact.storageKey,
    isDownload: true,
    expiresIn: PRESIGNED_URL_TTL_MS,
    responseContentDisposition: `attachment; filename="${artifact.fileName}"`,
  });

  return {
    status: "completed",
    downloadUrl,
    fileName: artifact.fileName,
    mimeType: artifact.mimeType,
  };
}
