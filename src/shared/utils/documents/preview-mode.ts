import { shouldHavePages } from "./document-processing";

/**
 * How a primary document version should be previewed, decided purely from
 * persisted state so it can be unit-tested in isolation.
 *
 * The critical invariant: a page-based document is only previewed as
 * generated page images when the actual DocumentPage row count matches the
 * declared page count. `hasPages: true` alone is NOT trusted — legacy rows can
 * claim the flag without any (or enough) DocumentPage rows existing, which
 * previously produced placeholder-only responses and an infinite loader.
 */
export type PreviewResolveResult =
  /** All pages are generated; render PreviewPagesViewer. */
  | { mode: "pages"; isProcessing: false }
  /** Render the raw PDF inline (converting, or legacy inconsistent state). */
  | { mode: "pdf"; isProcessing: boolean }
  /** Page-based but not a PDF and not ready; surface a processing message. */
  | { mode: "processing"; isProcessing: true }
  /** No page preview path applies; caller handles the type directly. */
  | { mode: "unsupported"; isProcessing: false };

export interface PreviewResolveInput {
  type?: string | null;
  file?: string | null;
  hasPages: boolean;
  numPages?: number | null;
  /** Number of DocumentPage rows that actually exist for the version. */
  generatedPageCount: number;
}

export function resolvePreviewMode({
  type,
  file,
  hasPages,
  numPages,
  generatedPageCount,
}: PreviewResolveInput): PreviewResolveResult {
  const isPdf = type === "pdf" || file?.toLowerCase().endsWith(".pdf");

  if (shouldHavePages(type)) {
    const pagesReady =
      hasPages &&
      !!numPages &&
      numPages > 0 &&
      generatedPageCount > 0 &&
      generatedPageCount >= numPages;

    if (pagesReady) {
      return { mode: "pages", isProcessing: false };
    }

    // PDFs can always fall back to the original file inline while conversion
    // catches up — even when a legacy row incorrectly says hasPages=true with
    // no (or partial) DocumentPage rows.
    if (isPdf) {
      return { mode: "pdf", isProcessing: true };
    }

    return { mode: "processing", isProcessing: true };
  }

  if (isPdf) {
    return { mode: "pdf", isProcessing: false };
  }

  return { mode: "unsupported", isProcessing: false };
}
