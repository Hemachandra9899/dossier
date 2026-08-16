import crypto from "crypto";

import { z } from "zod";

export const SignatureProviderNameSchema = z.enum(["DOCUMENSO", "NATIVE"]);
export type SignatureProviderName = z.infer<
  typeof SignatureProviderNameSchema
>;

// A raw provider event persisted to the SigningProviderEvent inbox. Every
// delivery is deduped on `dedupeKey` before any business processing happens.
export interface ProviderEventRecord {
  provider: SignatureProviderName;
  dedupeKey: string;
  eventType: string;
  externalId?: string | null;
  providerDocumentId?: number | null;
  payload: unknown;
}

export const providerEventPayloadSchema = z.object({
  event: z.string().min(1),
  payload: z.object({
    id: z.number().int().positive(),
    externalId: z.string().nullable().optional(),
  }),
});

/** Deterministic dedupe key. Documenso webhooks carry no delivery id, so the
 *  key is derived from the event + document id + externalId. */
export function createProviderEventDedupeKey(input: {
  event: string;
  externalId?: string | null;
  documentId?: number | null;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        input.event,
        input.externalId ?? null,
        input.documentId ?? null,
      ]),
    )
    .digest("hex");
}
