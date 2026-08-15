import type { RecipientInput } from "@/features/signing/api/signing-api";

export type RequestSignatureStep = "RECIPIENTS" | "PREPARE" | "REVIEW" | "SUCCESS";

export interface RecipientDraft extends RecipientInput {}

/** Client-side wizard state (never persisted). */
export interface RequestSignatureDraft {
  documentId: string;
  documentName: string;
  recipients: RecipientDraft[];
  templateId: string | null;
  editorReady: boolean;
  expiresAt: string | null;
}

export interface EditorSessionDraft {
  host: string;
  presignToken: string;
  envelopeId: string;
  externalId: string;
}

export const EXPIRATION_OPTIONS: Array<{
  label: string;
  value: string | null;
}> = [
  { label: "No expiration", value: null },
  { label: "7 days", value: "7" },
  { label: "14 days", value: "14" },
  { label: "30 days", value: "30" },
  { label: "60 days", value: "60" },
];

export function expirationToIso(value: string | null): string | null {
  if (!value) return null;
  const days = Number.parseInt(value, 10);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
