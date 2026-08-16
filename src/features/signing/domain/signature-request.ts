import { z } from "zod";

// Dossier owns the status vocabulary. Provider statuses are normalized
// centrally (see modules/signing/providers/documenso/mapper.ts); raw provider
// statuses never reach the UI.

export const SignatureRequestStatusSchema = z.enum([
  "DRAFT",
  "PREPARING",
  "READY",
  "SENT",
  "VIEWED",
  "SIGNING",
  "PARTIALLY_SIGNED",
  "COMPLETED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
]);

export type SignatureRequestStatus = z.infer<
  typeof SignatureRequestStatusSchema
>;

export const SIGNATURE_REQUEST_TERMINAL_STATUSES = new Set<
  SignatureRequestStatus
>(["COMPLETED", "DECLINED", "EXPIRED", "CANCELLED", "FAILED"]);

export const isSignatureRequestTerminal = (
  status: SignatureRequestStatus,
) => SIGNATURE_REQUEST_TERMINAL_STATUSES.has(status);

// Statuses in which the request is actively working through recipients. While
// in one of these the client keeps the request fresh via polling.
export const SIGNATURE_REQUEST_ACTIVE_STATUSES = new Set<
  SignatureRequestStatus
>(["SENT", "VIEWED", "SIGNING", "PARTIALLY_SIGNED"]);

export const SIGNATURE_REQUEST_ACTIVE_POLL_INTERVAL_MS = 5_000;

/**
 * True when the client should poll for status changes. Active statuses poll;
 * terminal statuses stop immediately; DRAFT/PREPARING/READY never poll (the
 * request is not in flight until SENT).
 */
export function shouldPollSignatureRequest(
  status: SignatureRequestStatus,
): boolean {
  return SIGNATURE_REQUEST_ACTIVE_STATUSES.has(status);
}

/**
 * True when the sender may expose a shareable per-recipient signing link.
 * READY is deliberately excluded: a request is only shareable once SENT.
 */
export function canExposeSigningLink(
  status: SignatureRequestStatus,
): boolean {
  return SIGNATURE_REQUEST_ACTIVE_STATUSES.has(status);
}
