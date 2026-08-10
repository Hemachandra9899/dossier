// GetPublicRequest: recipient-facing request lookup used by the public signing
// page. Scoped by requestId only (no team knowledge) and never exposes
// recipient or team data — just the status gates and the document to render.

import { getFile } from "@/lib/files/get-file";

import type { SigningContext } from "./context";
import { SigningNotFoundError } from "../domain/signing-errors";
import type { SignatureRequestStatus } from "../domain/signature-request";

export interface PublicRequestDTO {
  id: string;
  status: SignatureRequestStatus;
  provider: string;
  expiresAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  document: {
    id: string;
    name: string;
    contentType: string | null;
    fileUrl: string;
  };
}

export interface GetPublicRequestInput {
  requestId: string;
}

export async function getPublicRequest(
  ctx: SigningContext,
  input: GetPublicRequestInput,
): Promise<PublicRequestDTO> {
  const request = await ctx.requests.findByIdWithDocument(input.requestId);
  if (!request || !request.document) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  const fileUrl = await getFile({
    type: request.document.storageType,
    data: request.document.file,
    expiresIn: 60_000,
  });

  return {
    id: request.id,
    status: request.status,
    provider: request.provider,
    expiresAt: request.expiresAt,
    completedAt: request.completedAt,
    cancelledAt: request.cancelledAt,
    document: {
      id: request.document.id,
      name: request.document.name,
      contentType: request.document.contentType,
      fileUrl,
    },
  };
}
