/**
 * Split the pages requested from preview-pages into those that were resolved
 * by an actual DocumentPage row and those that are still missing. A missing
 * page must never be silently treated as success.
 */
export function partitionPageNumbers(
  requested: number[],
  found: number[],
): { found: number[]; missing: number[] } {
  const foundSet = new Set(found);
  const missing = requested.filter((pn) => !foundSet.has(pn));
  return { found, missing };
}
