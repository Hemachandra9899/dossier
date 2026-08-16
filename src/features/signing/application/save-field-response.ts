// SaveFieldResponse: persists a single recipient's response on one field
// (text/checkbox/etc. value or a drawn/uploaded signature image). Access is
// proven by the route layer (HttpOnly recipient-access cookie); the use-case
// only mutates fields that belong to the caller's recipient + request.
//
// Signatures/initials complete via `signatureStorageKey`; other fields via
// `value`. The field is marked complete per the field domain when the response
// counts as complete.

import type { SignatureField } from "@prisma/client";

import type { SigningContext } from "./context";
import { isFieldComplete } from "../domain/signature-field";
import {
  SigningNotFoundError,
  SigningStateError,
  SigningValidationError,
} from "../domain/signing-errors";
export interface SaveFieldResponseInput {
  requestId: string;
  recipientId: string;
  fieldId: string;
  value?: unknown;
  signatureStorageKey?: string | null;
}

export interface SaveFieldResponseResult {
  fieldId: string;
  complete: boolean;
}

const SIGNABLE_STATUSES = new Set(["SENT", "VIEWED", "SIGNING", "PARTIALLY_SIGNED"]);

export async function saveFieldResponse(
  ctx: SigningContext,
  input: SaveFieldResponseInput,
): Promise<SaveFieldResponseResult> {
  const request = await ctx.requests.findByIdForRecipient(input.requestId);
  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  if (!SIGNABLE_STATUSES.has(request.status)) {
    throw new SigningStateError(
      `Fields cannot be filled while the request is ${request.status}.`,
    );
  }

  const field = await ctx.fields.findById(input.fieldId);
  if (
    field.signatureRequestId !== input.requestId ||
    field.recipientId !== input.recipientId
  ) {
    throw new SigningNotFoundError("Signature field was not found.");
  }

  if (field.type !== "SIGNATURE" && field.type !== "INITIALS") {
    if (input.signatureStorageKey !== undefined) {
      throw new SigningValidationError(
        "signatureStorageKey is only valid for SIGNATURE / INITIALS fields.",
      );
    }
  }

  const value: unknown =
    input.value !== undefined ? input.value : field.value;
  const signatureStorageKey =
    input.signatureStorageKey !== undefined
      ? input.signatureStorageKey
      : field.signatureStorageKey;

  const complete = isFieldComplete({
    type: field.type,
    value: value as SignatureField["value"],
    signatureStorageKey,
    options: field.options,
  });

  await ctx.fields.updateResponse({
    fieldId: field.id,
    value: value === null ? undefined : value,
    signatureStorageKey: signatureStorageKey ?? null,
    completedAt: complete ? new Date() : null,
  });

  return { fieldId: field.id, complete };
}