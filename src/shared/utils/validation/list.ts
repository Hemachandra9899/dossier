type FilterMode = "email" | "domain" | "both";

const LIST_SEPARATOR_REGEX = /[,;\n\r\t]+/;

export type ListValidation = {
  /** All entries entered by the user (de-duplicated, lower-cased). */
  all: string[];
  /** Subset of `all` that passes validation for the requested mode. */
  valid: string[];
  /** Subset of `all` that did NOT pass validation. */
  invalid: string[];
};

/**
 * Splits a free-form text list of emails / domains by any combination of
 * comma, semicolon, newline, carriage return, or tab characters and
 * returns the unique, validated entries.
 */
export const validateList = (
  list: string,
  mode: FilterMode = "both",
): ListValidation => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const domainRegex = /^@[^\s@]+\.[^\s@]+$/;

  const isValid = (item: string): boolean => {
    if (mode === "email") return emailRegex.test(item);
    if (mode === "domain") return domainRegex.test(item);
    return emailRegex.test(item) || domainRegex.test(item);
  };

  const seen = new Set<string>();
  const all: string[] = [];
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const raw of list.split(LIST_SEPARATOR_REGEX)) {
    const item = raw.trim().toLowerCase();
    if (!item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    all.push(item);
    if (isValid(item)) {
      valid.push(item);
    } else {
      invalid.push(item);
    }
  }

  return { all, valid, invalid };
};

/**
 * Backwards-compatible helper that returns only the valid, de-duplicated
 * entries from a free-form list. Accepts comma, semicolon, newline,
 * carriage return, and tab as separators.
 */
export const sanitizeList = (
  list: string,
  mode: FilterMode = "both",
): string[] => validateList(list, mode).valid;
