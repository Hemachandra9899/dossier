// Guarded download + SHA-256 of the final signed PDF before it is mirrored
// into Dossier-owned storage. Mirrors the size-capped streaming pattern from
// lib/signing/mirror.ts and adds artifact hashing for the immutable store.

import crypto from "crypto";

export const MAX_SIGNED_ARTIFACT_BYTES = 50 * 1024 * 1024;

export interface DownloadSignedArtifactResult {
  buffer: Buffer;
  sha256: string;
}

const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

/** Download a signed PDF with a hard size ceiling and compute its SHA-256
 *  while streaming (never buffers more than `maxBytes` in memory). */
export async function downloadSignedArtifact(
  url: string,
  maxBytes = MAX_SIGNED_ARTIFACT_BYTES,
): Promise<DownloadSignedArtifactResult> {
  const response = await fetchWithTimeout(url, 30_000);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch signed PDF from provider (status ${response.status})`,
    );
  }

  const advertisedLength = response.headers.get("content-length");
  if (advertisedLength) {
    const advertised = Number.parseInt(advertisedLength, 10);
    if (Number.isFinite(advertised) && advertised > maxBytes) {
      throw new Error(
        `Signed PDF exceeds artifact cap (${advertised} > ${maxBytes} bytes)`,
      );
    }
  }

  const hash = crypto.createHash("sha256");
  const chunks: Buffer[] = [];
  let total = 0;

  if (!response.body) {
    const fallback = Buffer.from(await response.arrayBuffer());
    if (fallback.byteLength > maxBytes) {
      throw new Error("Signed PDF exceeds artifact cap");
    }
    hash.update(fallback);
    return { buffer: fallback, sha256: hash.digest("hex") };
  }

  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error("Signed PDF exceeds artifact cap");
    }

    const chunk = Buffer.from(value);
    hash.update(chunk);
    chunks.push(chunk);
  }

  return { buffer: Buffer.concat(chunks, total), sha256: hash.digest("hex") };
}
