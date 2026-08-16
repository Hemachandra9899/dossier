// MirrorSignedArtifact: durable mirroring of the final signed PDF into
// Dossier-owned storage. Runs inside a Trigger.dev task (retries on failure);
// idempotent — the SignatureArtifact row is immutable and never overwritten.

import crypto from "crypto";

import type { SigningContext } from "./context";
import { safeSlugify } from "@/shared/utils/utils";

const MAX_SIGNED_PDF_BYTES = 50 * 1024 * 1024;

const isUniqueConstraintViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

export type MirrorResult =
  | { mirrored: true; storageKey: string }
  | { mirrored: false; reason: string };

export async function mirrorSignedArtifact(
  ctx: SigningContext,
  input: { requestId: string },
): Promise<MirrorResult> {
  const request = await ctx.requests.findByIdForMirror(input.requestId);
  if (!request) return { mirrored: false, reason: "request-not-found" };

  const existing = await ctx.artifacts.findByRequestId(input.requestId);
  if (existing) return { mirrored: false, reason: "already-mirrored" };

  if (request.status !== "COMPLETED") {
    return { mirrored: false, reason: "not-completed" };
  }

  // NATIVE requests produce the artifact in the finalizer at completion time;
  // the mirror job is a no-op (the artifact is already Dossier-owned storage).
  if (request.provider === "NATIVE") {
    return { mirrored: false, reason: "native-finalized-inline" };
  }

  if (!request.providerEnvelopeId) {
    return { mirrored: false, reason: "missing-envelope" };
  }

  // Provider returns raw bytes + mimeType; no extra HTTP hop needed.
  const { bytes, mimeType } = await ctx.provider.getSignedArtifact({
    providerEnvelopeId: request.providerEnvelopeId,
    providerDocumentId: request.providerDocumentId,
  });

  if (bytes.byteLength > MAX_SIGNED_PDF_BYTES) {
    return { mirrored: false, reason: "exceeds-size-limit" };
  }

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  const safeName = safeSlugify(request.document.name).slice(0, 60) || "signed";
  const fileName = `${safeName}_signed.pdf`;

  const storageKey = await ctx.storage.putSignedPdf(
    request.teamId,
    request.id,
    bytes,
  );

  try {
    await ctx.artifacts.create({
      signatureRequestId: request.id,
      storageKey,
      fileName,
      mimeType,
      sha256,
      sizeBytes: BigInt(bytes.byteLength),
    });
  } catch (error) {
    // Immutable write collision: another run already mirrored the file.
    if (isUniqueConstraintViolation(error)) {
      return { mirrored: false, reason: "already-mirrored" };
    }
    throw error;
  }

  ctx.logger.info("signing.artifact_mirrored", {
    requestId: request.id,
    teamId: request.teamId,
    storageKey,
    sizeBytes: bytes.byteLength,
  });

  if (request.dossierFileId) {
    try {
      const { syncDossierFileStatus } = await import("@/features/files");
      await syncDossierFileStatus(request.dossierFileId, {
        dedupeKey: `signature-completed:${request.id}`,
      });
    } catch (err) {
      ctx.logger.error(
        "signing.sync_dossier_file_status_failed",
        { requestId: request.id },
        err,
      );
    }
  }

  return { mirrored: true, storageKey };
}