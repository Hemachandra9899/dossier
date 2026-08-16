// SendRequest: validates the request's fields and distributes the request
// exactly once. This is the sender's final step:
//
// 1. Load the request + recipients; the request must be DRAFT / PREPARING /
//    READY.
// 2. Server-side field validation (never trust the client): every signer must
//    have at least one assigned field AND at least one SIGNATURE / INITIALS
//    field. Failures throw SigningSendError (409).
// 3. Move the request to READY (from DRAFT or PREPARING) — READY still exposes
//    no signing link.
// 4. Distribute the request:
//    - NATIVE: nothing to call — fields already live in Dossier. Invitations
//      are the only external action.
//    - DOCUMENSO: distribute the ONE provider envelope exactly once
//      (`distributionMethod: "NONE"` keeps Documenso from emailing).
// 5. Deliver the Dossier invitations; the first delivery moves the request
//    READY -> SENT.

import type { SigningContext } from "./context";
import type { RequestDTO } from "./dto";
import { toRequestDTO } from "./dto";
import { deliverSignatureRequest } from "./deliver-signature-request";
import { getActiveSigningProvider } from "../config";
import { assertCanTransitionTo } from "../domain/state-machine";
import {
  SigningSendError,
  SigningStateError,
  SigningValidationError,
} from "../domain/signing-errors";

export interface SendRequestInput {
  actor: { userId: string; teamId: string };
  requestId: string;
}

export interface SendRequestResult {
  request: RequestDTO;
}

const SENDABLE_STATUSES = new Set(["DRAFT", "PREPARING", "READY"]);
// NATIVE field types that satisfy the "every signer needs a signature field"
// requirement. Documenso's FREE_SIGNATURE maps to SIGNATURE conceptually.
const SIGNATURE_FIELD_TYPES = new Set(["SIGNATURE", "INITIALS", "FREE_SIGNATURE"]);

export async function sendRequest(
  ctx: SigningContext,
  input: SendRequestInput,
): Promise<SendRequestResult> {
  const request = await ctx.requests.findByTeamAndIdWithRecipients(
    input.actor.teamId,
    input.requestId,
  );

  if (!SENDABLE_STATUSES.has(request.status)) {
    throw new SigningStateError(
      `Request cannot be sent from status ${request.status}.`,
    );
  }

  const rawSigners = request.recipients;
  if (rawSigners.length === 0) {
    throw new SigningValidationError(
      "A signature request must include at least one signer.",
    );
  }

  const engine = getActiveSigningProvider();

  // --- Server-side field validation. ---
  // NATIVE validates against the Dossier-owned SignatureField layout.
  // DOCUMENSO validates against the provider envelope fields.
  const missingFields: string[] = [];
  const missingSignature: string[] = [];

  if (engine === "NATIVE" || request.provider === "NATIVE") {
    const nativeFields = await ctx.fields.listByRequestId(request.id);
    const fieldsByRecipient = new Map<string, typeof nativeFields>();
    for (const f of nativeFields) {
      const arr = fieldsByRecipient.get(f.recipientId) ?? [];
      arr.push(f);
      fieldsByRecipient.set(f.recipientId, arr);
    }

    for (const recipient of rawSigners) {
      if (!recipient.email) {
        throw new SigningValidationError(
          "Every signer must have an email address.",
        );
      }
      const assigned = fieldsByRecipient.get(recipient.id) ?? [];
      if (assigned.length === 0) {
        missingFields.push(recipient.email);
        continue;
      }
      const hasSignatureField = assigned.some((f) =>
        SIGNATURE_FIELD_TYPES.has(f.type),
      );
      if (!hasSignatureField) {
        missingSignature.push(recipient.email);
      }
    }
  } else {
    // Documenso envelope-flow validation (legacy).
    if (!request.providerEnvelopeId) {
      throw new SigningStateError(
        "Request has not been initialized with the signing provider.",
      );
    }

    for (const recipient of rawSigners) {
      if (!recipient.email) {
        throw new SigningValidationError(
          "Every signer must have an email address.",
        );
      }
      if (!recipient.providerRecipientId) {
        throw new SigningValidationError(
          `Signer ${recipient.email} has not been assigned by the signing provider.`,
        );
      }
    }

    const envelope = await ctx.provider.getEnvelope(request.providerEnvelopeId);
    const fields: Array<{ recipientId: number | string; type: string }> =
      Array.isArray(envelope?.fields) ? envelope.fields : [];

    for (const recipient of rawSigners) {
      const providerRecipientId = Number(recipient.providerRecipientId);
      const assigned = fields.filter(
        (field) => Number(field.recipientId) === providerRecipientId,
      );
      if (assigned.length === 0) {
        missingFields.push(recipient.email as string);
        continue;
      }
      const hasSignatureField = assigned.some((field) =>
        SIGNATURE_FIELD_TYPES.has(field.type),
      );
      if (!hasSignatureField) {
        missingSignature.push(recipient.email as string);
      }
    }
  }

  if (missingFields.length > 0) {
    throw new SigningSendError(
      "SIGNATURE_FIELDS_REQUIRED",
      "Every signer needs at least one field assigned in the document.",
      missingFields,
    );
  }

  if (missingSignature.length > 0) {
    throw new SigningSendError(
      "SIGNATURE_REQUIRED",
      "Every signer needs a signature field (SIGNATURE or INITIALS) assigned in the document.",
      missingSignature,
    );
  }

  const signers = rawSigners.map((recipient) => ({
    id: recipient.id,
    email: (recipient.email as string) ?? "",
    name: recipient.name ?? null,
  }));

  // --- READY (no signing link is exposed in this state). ---
  if (request.status !== "READY") {
    assertCanTransitionTo(request.status as never, "READY");
    await ctx.requests.updateStatus(request.id, "READY");
  }

  // --- Distribute exactly once. ---
  if (engine !== "NATIVE" && request.provider !== "NATIVE" && request.providerEnvelopeId) {
    await ctx.provider.distributeEnvelope({
      providerEnvelopeId: request.providerEnvelopeId,
    });
  }

  // --- Deliver invitations; first delivery flips READY -> SENT. ---
  for (const recipient of signers) {
    await deliverSignatureRequest(ctx, {
      requestId: request.id,
      recipientId: recipient.id,
    });
  }

  const sentRequest = await ctx.requests.findById(request.id);

  ctx.logger.info("signing.request_sent", {
    teamId: sentRequest.teamId,
    requestId: sentRequest.id,
    recipientCount: sentRequest.recipients.length,
  });

  return { request: toRequestDTO(sentRequest) };
}