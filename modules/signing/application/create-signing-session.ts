// CreateSigningSession: recipient-facing session creation. Enforces signability
// (terminal states and expiry), binds the recipient identity to the request,
// calls SigningProvider.createSigningSession and returns a generic session DTO.
//
// Rate limiting + continuity-token cookie handling live in the route layer
// (mirrors the legacy `/agreements/signing/session` protections).

import type { SigningContext } from "./context";
import { isSignatureRequestTerminal } from "../domain/signature-request";
import { assertCanTransitionTo } from "../domain/state-machine";
import {
  SigningNotFoundError,
  SigningStateError,
  SigningValidationError,
} from "../domain/signing-errors";

export interface CreateSigningSessionInput {
  requestId: string;
  recipientId: string;
  email?: string | null;
  name?: string | null;
}

export interface SigningSessionDTO {
  requestId: string;
  recipientId: string;
  status: string;
  provider: "DOCUMENSO";
  host: string;
  token: string;
  externalId: string;
}

export async function createSigningSession(
  ctx: SigningContext,
  input: CreateSigningSessionInput,
): Promise<SigningSessionDTO> {
  const request = await ctx.requests.findByIdWithRecipients(input.requestId);
  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  // Enforce expiry before any other signability check.
  let status = request.status;
  if (
    request.expiresAt &&
    request.expiresAt.getTime() <= Date.now() &&
    !isSignatureRequestTerminal(status)
  ) {
    assertCanTransitionTo(status, "EXPIRED");
    await ctx.requests.updateStatus(request.id, "EXPIRED");
    status = "EXPIRED";
  }

  // Enforce terminal states: CANCELLED / COMPLETED / DECLINED / EXPIRED /
  // FAILED requests cannot open new signing sessions.
  if (isSignatureRequestTerminal(status)) {
    throw new SigningStateError(
      `Signature request is not signable (status: ${status}).`,
    );
  }

  const recipient = request.recipients.find(
    (item) => item.id === input.recipientId,
  );
  if (!recipient) {
    throw new SigningNotFoundError("Signing recipient was not found.");
  }

  // Identity binding: an explicitly-provided email must match the recipient
  // attached to this request (case-insensitive).
  if (input.email) {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (
      !recipient.email ||
      recipient.email.trim().toLowerCase() !== normalizedEmail
    ) {
      throw new SigningValidationError(
        "The recipient identity does not match this signing request.",
      );
    }
  }

  const requestTemplate = await ctx.templates.findById(request.templateId);
  if (!requestTemplate?.providerTemplateId || !request.providerEnvelopeId) {
    throw new SigningStateError(
      "The request has not been initialized with the signing provider.",
    );
  }

  // Move the request into SIGNING when it is not already signing.
  if (status !== "SIGNING") {
    assertCanTransitionTo(status, "SIGNING");
    await ctx.requests.updateStatus(request.id, "SIGNING");
    status = "SIGNING";
  }

  await ctx.requests.updateRecipientStatus(recipient.id, "SIGNING");

  const session = await ctx.provider.createSigningSession({
    providerTemplateId: requestTemplate.providerTemplateId,
    providerEnvelopeId: request.providerEnvelopeId,
    providerDocumentId: recipient.providerDocumentId ?? request.providerDocumentId,
    externalId: request.providerExternalId,
    recipient: {
      email: recipient.email ?? input.email,
      name: recipient.name ?? input.name,
    },
  });

  ctx.logger.info("signing.signing_session_created", {
    requestId: request.id,
    recipientId: recipient.id,
  });

  return {
    requestId: request.id,
    recipientId: recipient.id,
    status,
    provider: "DOCUMENSO",
    host: session.host,
    token: session.token,
    externalId: session.externalId,
  };
}
