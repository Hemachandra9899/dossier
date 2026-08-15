// SendRequest: validates the request's fields against the provider envelope and
// dispatches invitations. This is the sender's final step:
//
// 1. Load the request + recipients + template; the request must be
//    DRAFT / PREPARING / READY and initialized with the provider.
// 2. Server-side field validation (never trust the client): every signer must
//    have at least one assigned field AND at least one SIGNATURE / FREE_SIGNATURE
//    field on the provider envelope. Failures throw SigningSendError (409).
// 3. Move the request to READY (from DRAFT or PREPARING) — READY still exposes
//    no signing link.
// 4. Mint one per-visitor signing document per recipient via the provider and
//    persist the per-recipient providerDocumentId.
// 5. Deliver the Dossier invitations (recipient token + email); the first
//    delivery moves the request READY -> SENT.

import type { SigningContext } from "./context";
import type { RequestDTO } from "./dto";
import { toRequestDTO } from "./dto";
import { deliverSignatureRequest } from "./deliver-signature-request";
import { assertCanTransitionTo } from "../domain/state-machine";
import {
  SigningProviderError,
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
const SIGNATURE_FIELD_TYPES = new Set(["SIGNATURE", "FREE_SIGNATURE"]);

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

  const template = await ctx.templates.findById(request.templateId);
  if (
    !template ||
    template.status !== "READY" ||
    !template.providerTemplateId
  ) {
    throw new SigningStateError(
      "Request has not been initialized with the signing provider.",
    );
  }

  if (!request.providerEnvelopeId) {
    throw new SigningStateError(
      "Request has no provider envelope to validate fields against.",
    );
  }

  const rawSigners = request.recipients;
  if (rawSigners.length === 0) {
    throw new SigningValidationError(
      "A signature request must include at least one signer.",
    );
  }

  // After the guards below every signer provably has an email + provider id.
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

  const signers: Array<{
    id: string;
    email: string;
    name: string | null;
    providerRecipientId: string;
  }> = rawSigners.map((recipient) => ({
    id: recipient.id,
    email: recipient.email as string,
    name: recipient.name ?? null,
    providerRecipientId: recipient.providerRecipientId as string,
  }));

  // --- Server-side field validation against the provider envelope. ---
  const envelope = await ctx.provider.getEnvelope(request.providerEnvelopeId);
  const fields: Array<{
    recipientId: number | string;
    type: string;
  }> = Array.isArray(envelope?.fields) ? envelope.fields : [];

  const missingFields: string[] = [];
  const missingSignature: string[] = [];

  for (const recipient of signers) {
    const providerRecipientId = Number(recipient.providerRecipientId);
    const assigned = fields.filter(
      (field) => Number(field.recipientId) === providerRecipientId,
    );

    if (assigned.length === 0) {
      missingFields.push(recipient.email);
      continue;
    }

    const hasSignatureField = assigned.some((field) =>
      SIGNATURE_FIELD_TYPES.has(field.type),
    );
    if (!hasSignatureField) {
      missingSignature.push(recipient.email);
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
      "Every signer needs a signature field (SIGNATURE or FREE_SIGNATURE) assigned in the document.",
      missingSignature,
    );
  }

  // --- READY (no signing link is exposed in this state). ---
  if (request.status !== "READY") {
    assertCanTransitionTo(request.status as never, "READY");
    await ctx.requests.updateStatus(request.id, "READY");
  }

  // --- Mint per-recipient signing documents. ---
  const sent = await ctx.provider.sendEnvelope({
    providerTemplateId: template.providerTemplateId,
    recipients: signers.map((recipient) => ({
      providerRecipientId: recipient.providerRecipientId,
      email: recipient.email,
      name: recipient.name,
      externalId: `${request.providerExternalId}:${recipient.id}`,
    })),
  });

  const byProviderRecipientId = new Map(
    sent.map((item) => [item.providerRecipientId, item]),
  );

  for (const recipient of signers) {
    const match = byProviderRecipientId.get(recipient.providerRecipientId);
    if (!match) {
      throw new SigningProviderError(
        `The signing provider did not return a document for ${recipient.email}.`,
      );
    }
    await ctx.requests.updateRecipientProviderIds(recipient.id, {
      providerDocumentId: match.providerDocumentId,
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
