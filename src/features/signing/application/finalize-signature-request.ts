// FinalizeSignatureRequest: the native PDF finalizer. Stamps all completed
// field responses onto the pinned source PDF, stores the immutable signed PDF
// in Dossier-owned storage, writes the SignatureArtifact row and moves the
// request to COMPLETED.
//
// Idempotent: if an artifact already exists the request is already finalized;
// the method ensures COMPLETED and returns without re-stamping. A source-hash
// mismatch (the source bytes changed after the request was pinned) is a hard
// failure — the signer must never silently sign a different document.

import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { SigningContext } from "./context";
import { normalizedToPdfRect } from "../domain/signature-field";
import { assertCanTransitionTo } from "../domain/state-machine";
import { SigningStateError } from "../domain/signing-errors";
import { safeSlugify } from "@/shared/utils/utils";

const isUniqueConstraintViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

export interface FinalizeSignatureRequestInput {
  requestId: string;
}

export type FinalizeSignatureRequestResult =
  | { finalized: true; storageKey: string; sha256: string }
  | { finalized: false; reason: string };

const BLACK = rgb(0, 0, 0);

export async function finalizeSignatureRequest(
  ctx: SigningContext,
  input: FinalizeSignatureRequestInput,
): Promise<FinalizeSignatureRequestResult> {
  const request = await ctx.requests.findByIdForMirror(input.requestId);
  if (!request) return { finalized: false, reason: "request-not-found" };

  const existing = await ctx.artifacts.findByRequestId(input.requestId);
  if (existing) {
    if (request.status !== "COMPLETED") {
      assertCanTransitionTo(request.status, "COMPLETED");
      await ctx.requests.updateStatus(request.id, "COMPLETED", {
        completedAt: new Date(),
      });
    }
    return { finalized: false, reason: "already-finalized" };
  }

  if (request.status !== "SIGNING" && request.status !== "PARTIALLY_SIGNED") {
    return { finalized: false, reason: `not-signing:${request.status}` };
  }

  // Resolve the exact pinned source version. Native requests always pin; the
  // fallback only covers legacy rows created before version pinning existed.
  const { version } = await ctx.documents.findVersionForRequest(
    request.teamId,
    request.documentId,
    request.documentVersionId,
  );

  const source = await ctx.getDocumentFileBytes({
    file: version.file,
    storageType: version.storageType,
  });

  if (request.sourceSha256) {
    const actualSourceHash = createHash("sha256").update(source).digest("hex");
    if (actualSourceHash !== request.sourceSha256) {
      throw new SigningStateError(
        "Signed PDF source hash does not match the version pinned to this request.",
      );
    }
  }

  const fields = await ctx.fields.listByRequestId(request.id);
  const fieldsByPage = new Map<number, typeof fields>();
  for (const field of fields) {
    const arr = fieldsByPage.get(field.pageNumber) ?? [];
    arr.push(field);
    fieldsByPage.set(field.pageNumber, arr);
  }

  const pdf = await PDFDocument.load(source, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  const maxPage = Math.min(Math.max(0, ...fieldsByPage.keys()), pages.length);

  for (let pageIndex = 0; pageIndex < maxPage; pageIndex++) {
    const pageFields = fieldsByPage.get(pageIndex + 1) ?? [];
    if (pageFields.length === 0) continue;
    const page = pages[pageIndex];
    if (!page) continue;

    const { width: pageWidth, height: pageHeight } = page.getSize();

    for (const field of pageFields) {
      const rect = normalizedToPdfRect(
        { x: field.x, y: field.y, width: field.width, height: field.height },
        { width: pageWidth, height: pageHeight },
      );

      switch (field.type) {
        case "SIGNATURE":
        case "INITIALS": {
          if (!field.signatureStorageKey) break;
          const signatureBytes = await ctx.getSignatureImageBytes(
            field.signatureStorageKey,
          );
          if (!signatureBytes) break;
          try {
            const image = await pdf.embedPng(signatureBytes);
            page.drawImage(image, {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            });
          } catch {
            // A signature blob that is not a valid PNG is skipped rather than
            // failing the whole finalization; the field's response metadata
            // still audit-logs what was captured.
          }
          break;
        }

        case "TEXT":
        case "NAME":
        case "EMAIL":
        case "DATE":
        case "NUMBER":
        case "DROPDOWN":
        case "RADIO": {
          const text = stringifyValue(field.value);
          if (!text) break;
          const size = Math.min(12, rect.height * 0.55);
          page.drawText(text, {
            x: rect.x + 2,
            y: rect.y + rect.height / 3,
            size,
            font,
            color: BLACK,
            maxWidth: rect.width - 4,
          });
          break;
        }

        case "CHECKBOX": {
          if (field.value !== true) break;
          const size = Math.min(rect.height * 0.8, rect.width * 0.8);
          page.drawText("X", {
            x: rect.x,
            y: rect.y + rect.height * 0.12,
            size,
            font,
            color: BLACK,
          });
          break;
        }
      }
    }
  }

  const output = Buffer.from(await pdf.save());
  const sha256 = createHash("sha256").update(output).digest("hex");

  const storageKey = await ctx.storage.putSignedPdf(
    request.teamId,
    request.id,
    output,
  );

  const safeName = safeSlugify(request.document.name).slice(0, 60) || "signed";
  const fileName = `${safeName}_signed.pdf`;

  try {
    await ctx.artifacts.create({
      signatureRequestId: request.id,
      storageKey,
      fileName,
      mimeType: "application/pdf",
      sha256,
      sizeBytes: BigInt(output.byteLength),
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { finalized: false, reason: "already-finalized" };
    }
    throw error;
  }

  await ctx.activities.create({
    signatureRequestId: request.id,
    type: "ARTIFACT_READY",
  });

  assertCanTransitionTo(request.status, "COMPLETED");
  await ctx.requests.updateStatus(request.id, "COMPLETED", {
    completedAt: new Date(),
  });

  await ctx.activities.create({
    signatureRequestId: request.id,
    type: "REQUEST_COMPLETED",
  });

  ctx.logger.info("signing.artifact_finalized", {
    requestId: request.id,
    teamId: request.teamId,
    storageKey,
    sizeBytes: output.byteLength,
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

  // Notify all signers of completion (best-effort; never fails the finalize).
  try {
    const { deliverCompletionEmail } = await import("./deliver-signature-request");
    await deliverCompletionEmail(ctx, request.id);
  } catch (err) {
    ctx.logger.error(
      "signing.deliver_completion_failed",
      { requestId: request.id },
      err,
    );
  }

  return { finalized: true, storageKey, sha256 };
}

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      return String((value as { label?: unknown }).label ?? JSON.stringify(value));
    } catch {
      return null;
    }
  }
  return null;
}