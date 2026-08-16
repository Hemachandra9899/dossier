// GetSourcePdf: returns a short-lived signed URL for the exact PDF version a
// signing request is pinned to. The sender editor and the recipient viewer use
// the same source so both always see the version that will actually be signed.
//
// Storage keys/credentials are never exposed; only the signed URL is returned.

import type { SigningContext } from "./context";
import { SigningNotFoundError } from "../domain/signing-errors";

export interface SourcePdfInput {
  teamId: string;
  requestId: string;
}

export interface SourcePdfResult {
  url: string;
  versionId: string;
  sha256: string | null;
}

export async function getSourcePdf(
  ctx: SigningContext,
  input: SourcePdfInput,
): Promise<SourcePdfResult> {
  const request = await ctx.requests.findByTeamAndIdWithRecipients(
    input.teamId,
    input.requestId,
  );

  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  const { version } = await ctx.documents.findVersionForRequest(
    input.teamId,
    request.documentId,
    request.documentVersionId,
  );

  const url = await ctx.getSourceUrl({
    file: version.file,
    storageType: version.storageType,
  });

  return {
    url,
    versionId: version.id,
    sha256: request.sourceSha256,
  };
}
