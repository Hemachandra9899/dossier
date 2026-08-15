import { z } from "zod";

export const SignatureRecipientStatusSchema = z.enum([
  "PENDING",
  "VIEWED",
  "SIGNING",
  "SIGNED",
  "DECLINED",
  "EXPIRED",
]);

export type SignatureRecipientStatus = z.infer<
  typeof SignatureRecipientStatusSchema
>;

export const SIGNATURE_RECIPIENT_TERMINAL_STATUSES = new Set<
  SignatureRecipientStatus
>(["SIGNED", "DECLINED", "EXPIRED"]);

export const isSignatureRecipientTerminal = (
  status: SignatureRecipientStatus,
) => SIGNATURE_RECIPIENT_TERMINAL_STATUSES.has(status);
