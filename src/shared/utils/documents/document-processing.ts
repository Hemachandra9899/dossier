/**
 * Document types whose preview is produced from generated page images.
 * These versions start with `hasPages: false` and are flipped to
 * `hasPages: true` only by their conversion task once DocumentPage rows
 * exist. Everything else is previewable as-is (image, sheet, html, ...).
 */
export const PAGE_BASED_DOCUMENT_TYPES = ["pdf", "docs", "slides", "cad"] as const;

export function shouldHavePages(type?: string | null): boolean {
  if (!type) return false;
  return (PAGE_BASED_DOCUMENT_TYPES as readonly string[]).includes(type);
}

/**
 * Whether a freshly created version can claim `hasPages: true` immediately.
 * Page-based documents must start at `false`; only the conversion task flips
 * the flag after every page has been rendered and stored.
 */
export function initialHasPages(type?: string | null): boolean {
  return !shouldHavePages(type);
}
