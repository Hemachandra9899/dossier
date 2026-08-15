// Recipient validation + normalization for signature requests. Used by both the
// API route layer (transport shape) and the create-request use-case (domain
// invariants: duplicate detection, email normalization).

import { z } from "zod";

import { SigningValidationError } from "./signing-errors";

export const signatureRecipientInputSchema = z.object({
  name: z.string().max(255).trim().nullable().optional(),
  email: z.string().email("Invalid recipient email.").max(255),
  phone: z.string().max(50).nullable().optional(),
  signingOrder: z.number().int().positive().default(1),
});

export const signatureRecipientsInputSchema = z
  .array(signatureRecipientInputSchema)
  .min(1, "At least one recipient is required.")
  .max(50, "Too many recipients.");

export interface NormalizedRecipient {
  name: string | null;
  email: string;
  phone: string | null;
  signingOrder: number;
}

export function normalizeRecipientEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates raw recipient input and returns recipients safe to persist.
 * Rejects empty lists, malformed rows and duplicate (case-insensitive) emails.
 */
export function validateAndNormalizeRecipients(raw: unknown): NormalizedRecipient[] {
  let parsed: ReturnType<typeof signatureRecipientsInputSchema.parse>;
  try {
    parsed = signatureRecipientsInputSchema.parse(raw);
  } catch {
    throw new SigningValidationError(
      "Recipients must be a non-empty list of valid recipient records.",
    );
  }
  const seen = new Set<string>();

  return parsed.map((recipient) => {
    const email = normalizeRecipientEmail(recipient.email);
    if (seen.has(email)) {
      throw new SigningValidationError(`Duplicate recipient email: ${email}`);
    }
    seen.add(email);
    return {
      name: recipient.name?.trim() ? recipient.name : null,
      email,
      phone: recipient.phone?.trim() ? recipient.phone : null,
      signingOrder: recipient.signingOrder,
    };
  });
}
