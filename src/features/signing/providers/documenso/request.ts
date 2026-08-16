// Raw REST helper for the Documenso v2 API where the Speakeasy SDK is not a
// good fit. The envelope-item download operation resolves to a pre-signed
// download URL (`{ downloadUrl }`) rather than raw bytes; the SDK types the
// response body as `any`, so the two hops below (download URL, then bytes)
// live here inside the provider boundary. Nothing outside
// providers/documenso may touch the raw Documenso REST API.

import { SigningProviderError } from "../../domain/signing-errors";
import { requireDocumensoConfig } from "../../config/signing-config";

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Downloads the signed version of an envelope item as raw bytes. Throws a
 * SigningProviderError on any transport, status or size failure so callers
 * can surface a single typed error.
 */
export async function downloadEnvelopeItemSignedPdf(
  envelopeItemId: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const config = requireDocumensoConfig();

  const url = new URL(
    `/envelope/item/${encodeURIComponent(envelopeItemId)}/download`,
    config.apiUrl,
  );
  url.searchParams.set("version", "signed");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw new SigningProviderError(
      "The signing provider could not be reached to download the signed document.",
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new SigningProviderError(
      `The signing provider rejected the signed document download (status ${response.status}).`,
    );
  }

  const body = (await response.json()) as { downloadUrl?: unknown };
  if (typeof body?.downloadUrl !== "string" || body.downloadUrl.length === 0) {
    throw new SigningProviderError(
      "The signing provider did not return a download URL for the signed document.",
    );
  }

  let download: Response;
  try {
    download = await fetch(body.downloadUrl);
  } catch (error) {
    throw new SigningProviderError(
      "The signed document could not be downloaded from the signing provider.",
      { cause: error },
    );
  }

  if (!download.ok) {
    throw new SigningProviderError(
      `The signed document download failed (status ${download.status}).`,
    );
  }

  const buffer = Buffer.from(await download.arrayBuffer());
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new SigningProviderError(
      "The signed document exceeds the download size limit.",
    );
  }

  return {
    bytes: new Uint8Array(buffer),
    mimeType: download.headers.get("content-type") ?? "application/pdf",
  };
}
