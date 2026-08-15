// MirrorSignedArtifact: durable mirroring of the final signed PDF into
// Dossier-owned storage. Runs inside a Trigger.dev task (retries on failure);
// idempotent — the SignatureArtifact row is immutable and never overwritten.

import crypto from "crypto";

import type { SigningContext } from "./context";
import { safeSlugify } from "@/shared/utils/utils";

const MAX_SIGNED_PDF_BYTES = 50 * 1024 * 1024;

const fetchSignedPdf = async (url: string): Promise<Buffer> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch signed PDF from the provider (status ${response.status})`,
    );
  }

  const advertisedLength = response.headers.get("content-length");
  if (advertisedLength) {
    const advertised = Number.parseInt(advertisedLength, 10);
    if (Number.isFinite(advertised) && advertised > MAX_SIGNED_PDF_BYTES) {
      throw new Error("Signed PDF exceeds mirror cap");
    }
  }

  if (!response.body) {
    const fallback = await response.arrayBuffer();
    if (fallback.byteLength > MAX_SIGNED_PDF_BYTES) {
      throw new Error("Signed PDF exceeds mirror cap");
    }
    return Buffer.from(fallback);
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_SIGNED_PDF_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error("Signed PDF exceeds mirror cap");
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, total);
};

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

  const existing = await ctx.requests.findArtifactByRequestId(input.requestId);
  if (existing) return { mirrored: false, reason: "already-mirrored" };

  if (request.status !== "COMPLETED") {
    return { mirrored: false, reason: "not-completed" };
  }
  if (!request.providerEnvelopeId) {
    return { mirrored: false, reason: "missing-envelope" };
  }

  const artifact = await ctx.provider.getSignedArtifact({
    providerEnvelopeId: request.providerEnvelopeId,
    providerDocumentId: request.providerDocumentId,
  });

  const body = await fetchSignedPdf(artifact.downloadUrl);
  const sha256 = crypto.createHash("sha256").update(body).digest("hex");

  const safeName = safeSlugify(request.document.name).slice(0, 60) || "signed";
  const fileName = `${safeName}_signed.pdf`;

  const { storageKey } = await ctx.storage.upload({
    teamId: request.teamId,
    requestId: request.id,
    fileName,
    body,
  });

  try {
    await ctx.requests.createArtifact({
      signatureRequestId: request.id,
      storageKey,
      fileName,
      mimeType: "application/pdf",
      sha256,
      sizeBytes: BigInt(body.byteLength),
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
    sizeBytes: body.byteLength,
  });

  if (request.dossierFileId) {
    try {
      const { syncDossierFileStatus } = await import(
        "@/features/files"
      );
      await syncDossierFileStatus(request.dossierFileId, {
        dedupeKey: `signature-completed:${request.id}`,
      });
    } catch (err) {
      ctx.logger.error("signing.sync_dossier_file_status_failed", { requestId: request.id }, err);
    }
  }

  return { mirrored: true, storageKey };
}
