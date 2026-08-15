export function normalizeCallbackUrl(
  value: string | null | undefined,
): string | undefined {
  if (!value || value.length === 0) return undefined;
  if (!value.startsWith("/")) return undefined;
  if (value.startsWith("//")) return undefined;

  try {
    const url = new URL(value, "http://dossier.local");
    if (url.host !== "dossier.local") return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}
