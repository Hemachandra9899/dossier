import slugify from "@sindresorhus/slugify";
import { transliterate } from "transliteration";
import { customAlphabet } from "nanoid";

export const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  7,
);

export function getExtension(url: string) {
  // @ts-ignore
  return url.split(/[#?]/)[0].split(".").pop().trim();
}

/**
 * Ensures a filename has a .pdf extension for watermarked documents
 * Removes any existing extension and adds .pdf
 */
export function getFileNameWithPdfExtension(filename?: string): string {
  if (!filename) return "document.pdf";

  // Remove existing extension and add .pdf
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  return `${nameWithoutExt}.pdf`;
}

/**
 * CJK-safe slugify: transliterates non-Latin characters (CJK, Cyrillic, etc.)
 * to their romanized equivalents before slugifying, so the same input always
 * produces the same slug. e.g. "文件报告" → "wen-jian-bao-gao"
 */
export function safeSlugify(input: string): string {
  const slug = slugify(input);
  if (slug.length > 0) return slug;
  return slugify(transliterate(input)) || nanoid();
}

/**
 * RFC 5987 percent-encoder for Content-Disposition `filename*` values.
 */
export function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*!~]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * Build a strictly RFC 5987-compliant Content-Disposition header so downstream
 * tooling (Gotenberg/LibreOffice, etc.) can parse it without errors.
 */
export function buildContentDisposition(
  originalFileName: string,
  slugifiedName: string,
): string {
  return `attachment; filename="${slugifiedName}"; filename*=UTF-8''${encodeRFC5987(originalFileName)}`;
}

/**
 * Build a Content-Disposition `attachment` header for a single download
 * filename (already including its extension).
 */
export function buildAttachmentDispositionForName(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : "";
  const sanitizedExt = /^\.[A-Za-z0-9]+$/.test(ext) ? ext : "";
  const slug = safeSlugify(base) + sanitizedExt;
  return buildContentDisposition(filename, slug);
}

export const getBreadcrumbPath = (path: string[]) => {
  const segments = path?.filter(Boolean);
  if (!Array.isArray(path) || path.length === 0) {
    return [{ name: "Home", pathLink: "/documents" }];
  }
  let currentPath = "documents/tree";

  return [
    { name: "Home", pathLink: "/documents" },
    ...segments.map((segment, index) => {
      currentPath += `/${safeSlugify(segment)}`;
      return {
        name: segment,
        pathLink: currentPath,
      };
    }),
  ];
};
