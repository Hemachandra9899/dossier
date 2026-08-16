// Native signing field domain: field catalog, normalized-coordinate helpers
// and completion semantics.
//
// Coordinates are ALWAYS normalized 0..1 relative to the PDF page so a field
// stays in the same place regardless of viewer size, zoom or device. Screen
// pixels are transient UI state and are never persisted.

import type { SignatureField, SignatureFieldType } from "@prisma/client";

export const SIGNATURE_FIELD_TYPES = [
  { type: "SIGNATURE", label: "Signature" },
  { type: "INITIALS", label: "Initials" },
  { type: "NAME", label: "Name" },
  { type: "EMAIL", label: "Email" },
  { type: "DATE", label: "Date" },
  { type: "TEXT", label: "Text" },
  { type: "NUMBER", label: "Number" },
  { type: "CHECKBOX", label: "Checkbox" },
  { type: "RADIO", label: "Radio" },
  { type: "DROPDOWN", label: "Dropdown" },
] as const satisfies ReadonlyArray<{
  type: SignatureFieldType;
  label: string;
}>;

export const SIGNATURE_FIELD_TYPE_LABELS = new Map(
  SIGNATURE_FIELD_TYPES.map(({ type, label }) => [type, label]),
);

export function getSignatureFieldTypeLabel(type: SignatureFieldType): string {
  return SIGNATURE_FIELD_TYPE_LABELS.get(type) ?? type;
}

/** Default normalized size used when a new field is dropped on a page. */
export const DEFAULT_FIELD_SIZE: Record<SignatureFieldType, { width: number; height: number }> = {
  SIGNATURE: { width: 0.25, height: 0.08 },
  INITIALS: { width: 0.16, height: 0.08 },
  NAME: { width: 0.22, height: 0.05 },
  EMAIL: { width: 0.22, height: 0.05 },
  DATE: { width: 0.18, height: 0.05 },
  TEXT: { width: 0.22, height: 0.05 },
  NUMBER: { width: 0.18, height: 0.05 },
  CHECKBOX: { width: 0.04, height: 0.04 },
  RADIO: { width: 0.04, height: 0.04 },
  DROPDOWN: { width: 0.22, height: 0.05 },
};

export interface PageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface PageSize {
  width: number;
  height: number;
}

/**
 * Converts a point in screen (viewport) coordinates into normalized 0..1
 * page coordinates. Used when a sender drops/moves a field on a PDF page.
 */
export function screenToNormalized(
  point: { x: number; y: number },
  pageRect: PageRect,
): NormalizedPoint {
  if (pageRect.width <= 0 || pageRect.height <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: (point.x - pageRect.left) / pageRect.width,
    y: (point.y - pageRect.top) / pageRect.height,
  };
}

/**
 * Converts a normalized field rect into screen pixel rect. The inverse of
 * screenToNormalized. Round-trip test: screenToNormalized -> normalizedToScreen
 * returns the original pixels (modulo float error).
 */
export function normalizedToScreen(
  rect: { x: number; y: number; width: number; height: number },
  pageSize: PageSize,
): { left: number; top: number; width: number; height: number } {
  return {
    left: rect.x * pageSize.width,
    top: rect.y * pageSize.height,
    width: rect.width * pageSize.width,
    height: rect.height * pageSize.height,
  };
}

/**
 * Converts a normalized field rect into PDF bottom-left coordinates.
 * Browsers are top-left based; PDFs are bottom-left based. The field's
 * top edge (normalizedY) is measured from the top of the page, so the PDF
 * y must be flipped and the field height subtracted.
 */
export function normalizedToPdfRect(
  rect: { x: number; y: number; width: number; height: number },
  pageSize: PageSize,
): { x: number; y: number; width: number; height: number } {
  const width = rect.width * pageSize.width;
  const height = rect.height * pageSize.height;
  return {
    x: rect.x * pageSize.width,
    y: pageSize.height - rect.y * pageSize.height - height,
    width,
    height,
  };
}

export interface FieldValueView {
  type: SignatureFieldType;
  value: unknown;
  signatureStorageKey: string | null;
  options: unknown;
}

/**
 * Whether a recipient response for a field counts as complete.
 * Signatures/initials complete via signatureStorageKey; checkbox needs true;
 * text-like fields need a non-empty string; radio/dropdown need a chosen option.
 */
export function isFieldComplete(field: Pick<SignatureField, "type" | "value" | "signatureStorageKey" | "options">): boolean {
  switch (field.type) {
    case "SIGNATURE":
    case "INITIALS":
      return typeof field.signatureStorageKey === "string" && field.signatureStorageKey.length > 0;
    case "CHECKBOX":
      return field.value === true;
    case "RADIO":
    case "DROPDOWN": {
      const value = field.value as unknown;
      return (
        typeof value === "string" &&
        value.length > 0 &&
        (typeof field.options === "undefined" ||
          field.options === null ||
          (Array.isArray(field.options) && field.options.includes(value)))
      );
    }
    default: {
      // NAME, EMAIL, DATE, TEXT, NUMBER
      const value = field.value as unknown;
      return typeof value === "string" && value.trim().length > 0;
    }
  }
}

/** Required fields that still need a value. */
export function getRemainingRequiredFields(
  fields: Array<Pick<SignatureField, "id" | "type" | "value" | "signatureStorageKey" | "required" | "options">>,
): Array<Pick<SignatureField, "id" | "type" | "value" | "signatureStorageKey" | "required" | "options">> {
  return fields.filter((field) => field.required && !isFieldComplete(field));
}

/**
 * Recipient-safe view of a stored field. Exposes the schema-derived `value` for
 * text-like / checkbox / radio / dropdown fields and a `complete` flag for every
 * type, but NEVER exposes the signature image storage key (the recipient already
 * has the value; the finalizer reads the image server-side).
 */
export interface RecipientFieldDTO {
  id: string;
  type: SignatureFieldType;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  label: string | null;
  placeholder: string | null;
  options: unknown;
  value: unknown;
  complete: boolean;
  completedAt: string | null;
}

export function toRecipientFieldDTO(
  field: Pick<
    SignatureField,
    | "id"
    | "type"
    | "pageNumber"
    | "x"
    | "y"
    | "width"
    | "height"
    | "required"
    | "label"
    | "placeholder"
    | "options"
    | "value"
    | "signatureStorageKey"
    | "completedAt"
  >,
): RecipientFieldDTO {
  const complete = isFieldComplete({
    type: field.type,
    value: field.value,
    signatureStorageKey: field.signatureStorageKey,
    options: field.options,
  });

  // Don't leak the signature storage key; only whether it's filled.
  const value =
    field.type === "SIGNATURE" || field.type === "INITIALS"
      ? complete
        ? "signed"
        : null
      : field.value;

  return {
    id: field.id,
    type: field.type,
    pageNumber: field.pageNumber,
    x: field.x,
    y: field.y,
    width: field.width,
    height: field.height,
    required: field.required,
    label: field.label,
    placeholder: field.placeholder,
    options: field.options,
    value,
    complete,
    completedAt: field.completedAt ? field.completedAt.toISOString() : null,
  };
}
