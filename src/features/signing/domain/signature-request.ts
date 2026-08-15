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
