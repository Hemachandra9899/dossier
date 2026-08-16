// CompleteRecipient: a recipient's final "Sign / Complete" action. Verifies
// every required field assigned to this recipient is complete, marks the
// recipient SIGNED, records activity, and either moves the request to
// PARTIALLY_SIGNED or hands off to the finalizer (all recipients signed ->
// COMPLETED + signed artifact).
//
// Idempotent: a recipient who already SIGNED returns the current request
// state without re-running the finalizer.

import type { SigningContext } from "./context";
import type { RequestDTO } from "./dto";
import { toRequestDTO } from "./dto";
import { isFieldComplete, getRemainingRequiredFields } from "../domain/signature-field";
import { assertCanTransitionTo } from "../domain/state-machine";
import {
  SigningNotFoundError,
  SigningStateError,
  SigningValidationError,
} from "../domain/signing-errors";

export interface CompleteRecipientInput {
  requestId: string;
  recipientId: string;
}

const SIGNABLE_STATUSES = new Set(["SENT", "VIEWED", "SIGNING", "PARTIALLY_SIGNED"]);

export async function completeRecipient(
  ctx: SigningContext,
  input: CompleteRecipientInput,
): Promise<RequestDTO> {
  const request = await ctx.requests.findByIdWithRecipients(input.requestId);
  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  if (!SIGNABLE_STATUSES.has(request.status)) {
    throw new SigningStateError(
      `This signature request cannot be completed (status: ${request.status}).`,
    );
  }

  const recipient = request.recipients.find(
    (item: any) => item.id === input.recipientId,
  );
  if (!recipient) {
    throw new SigningNotFoundError("Signing recipient was not found.");
  }

  // Idempotent: already-signed recipient returns current state.
  if (recipient.status === "SIGNED") {
    return toRequestDTO(request);
  }

  // Honor signing order: a recipient may only complete once every recipient
  // with a lower signingOrder has signed (sequential signing). Parallel
  // ordering (same signingOrder) is always allowed.
  if (recipient.signingOrder > 1) {
    const dueBefore = request.recipients.filter(
      (item: any) => item.signingOrder < recipient.signingOrder,
    );
    const pendingPredecessors = dueBefore.filter(
      (item: any) => item.status !== "SIGNED",
    );
    if (pendingPredecessors.length > 0) {
      throw new SigningStateError(
        "This recipient cannot sign until earlier recipients have signed.",
      );
    }
  }

  const fields = await ctx.fields.listByRequestAndRecipient(
    request.id,
    recipient.id,
  );

  const remaining = getRemainingRequiredFields(
    fields.map((f) => ({
      id: f.id,
      type: f.type,
      value: f.value,
      signatureStorageKey: f.signatureStorageKey,
      required: f.required,
      options: f.options,
    })),
  );

  if (remaining.length > 0) {
    throw new SigningValidationError(
      "Please complete all required fields before signing.",
    );
  }

  await ctx.recipients.updateStatus(recipient.id, "SIGNED", {
    signedAt: new Date(),
  });

  // Ensure SIGNATURE/INITIALS fields carry a completion stamp even when not
  // marked required (the response is what proves signing).
  for (const field of fields) {
    if (
      (field.type === "SIGNATURE" || field.type === "INITIALS") &&
      isFieldComplete({
        type: field.type,
        value: field.value,
        signatureStorageKey: field.signatureStorageKey,
        options: field.options,
      }) &&
      !field.completedAt
    ) {
      await ctx.fields.updateResponse({
        fieldId: field.id,
        completedAt: new Date(),
      });
    }
  }

  await ctx.activities.create({
    signatureRequestId: request.id,
    recipientId: recipient.id,
    type: "RECIPIENT_SIGNED",
  });

  const refreshed = await ctx.requests.findByIdWithRecipients(request.id);
  if (!refreshed) {
    return toRequestDTO(request);
  }

  const allSigned = refreshed.recipients.every(
    (item: any) => item.status === "SIGNED",
  );

  if (allSigned) {
    // Finalize synchronously for native; for legacy DOCUMENSO requests the
    // provider webhook drives the COMPLETED transition + artifact mirror.
    if (request.provider === "NATIVE") {
      const { finalizeSignatureRequest } = await import("./finalize-signature-request");
      await finalizeSignatureRequest(ctx, { requestId: request.id });
      const finalized = await ctx.requests.findByIdWithRecipients(request.id);
      return toRequestDTO(finalized ?? refreshed);
    }
    return toRequestDTO(refreshed);
  }

  if (refreshed.status !== "PARTIALLY_SIGNED" && refreshed.status !== "SIGNING") {
    assertCanTransitionTo(request.status, "PARTIALLY_SIGNED");
    await ctx.requests.updateStatus(request.id, "PARTIALLY_SIGNED");
  }

  return toRequestDTO(await ctx.requests.findByIdWithRecipients(request.id));
}