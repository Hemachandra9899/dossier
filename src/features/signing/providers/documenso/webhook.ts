// Documenso webhook verification + payload parsing. Kept in the provider
// module so the application webhook route stays provider-agnostic.

import crypto from "crypto";

import { z } from "zod";

import { getDocumensoWebhookSecret } from "./client";

export const DOCUMENSO_WEBHOOK_SECRET_HEADER = "x-documenso-secret";

export const documensoWebhookPayloadSchema = z.object({
  event: z.string(),
  payload: z.object({
    id: z.number().int().positive(),
    envelopeId: z.number().int().positive().nullable().optional(),
    externalId: z.string().nullable().optional(),
  }),
});

export type DocumensoWebhookPayload = z.infer<
  typeof documensoWebhookPayloadSchema
>;

/** Constant-time secret check. `configured: false` means the env secret is
 *  unset (the route should respond 503 so the provider keeps retrying). */
export const verifyDocumensoWebhookSecret = (
  secret?: string | null,
): { ok: boolean; configured: boolean } => {
  const expectedSecret = getDocumensoWebhookSecret();

  if (!expectedSecret) {
    return { ok: false, configured: false };
  }

  if (!secret || secret.length !== expectedSecret.length) {
    return { ok: false, configured: true };
  }

  const ok = crypto.timingSafeEqual(
    Buffer.from(secret),
    Buffer.from(expectedSecret),
  );

  return { ok, configured: true };
};
