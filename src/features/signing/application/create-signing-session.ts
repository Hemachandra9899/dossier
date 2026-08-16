// CreateSigningSession: recipient-facing session creation. Enforces signability
// (terminal states and expiry), binds the recipient identity to the request,
// and returns a session the signing page uses to render the document.
//
// - NATIVE: returns the pinned source PDF url + sha256 (no external provider).
// - DOCUMENSO: calls SigningProvider.getRecipientSigningSession and returns the
//   provider embed host/token.
//
// Rate limiting + continuity-token cookie handling live in the route layer
// (mirrors the legacy `/agreements/signing/session` protections).

import type { SigningContext } from "./context";
import { getActiveSigningProvider } from "../config";
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

export type SigningSessionDTO = {
  requestId: string;
  recipientId: string;
  status: string;
  provider: "NATIVE" | "DOCUMENSO";
} & (
  | { provider: "NATIVE"; sourceUrl: string; sourceSha256: string | null }
  | {
      provider: "DOCUMENSO";
      host: string;
      token: string;
      externalId: string;
    }
);

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
    (item: any) => item.id === input.recipientId,
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

  const engine = getActiveSigningProvider();

  // DOCUMENSO requires provider initialization before signing.
  if (engine !== "NATIVE" && request.provider !== "NATIVE") {
    if (!request.providerEnvelopeId || !recipient.providerRecipientId) {
      throw new SigningStateError(
        "The request has not been initialized with the signing provider.",
      );
    }
  }

  // Move the request into SIGNING when it is not already signing.
  if (status !== "SIGNING") {
    assertCanTransitionTo(status, "SIGNING");
    await ctx.requests.updateStatus(request.id, "SIGNING");
    status = "SIGNING";
  }

  await ctx.recipients.updateStatus(recipient.id, "SIGNING");

  await ctx.activities.create({
    signatureRequestId: request.id,
    recipientId: recipient.id,
    type: "SIGNING_STARTED",
  });

  ctx.logger.info("signing.signing_session_created", {
    requestId: request.id,
    recipientId: recipient.id,
    engine,
  });

  if (engine === "NATIVE" || request.provider === "NATIVE") {
    // Resolve the pinned source PDF url the signer page renders. The same
    // version the sender pinned at draft creation.
    const { version } = await ctx.documents.findVersionForRequest(
      request.teamId,
      request.documentId,
      request.documentVersionId,
    );
    const sourceUrl = await ctx.getSourceUrl({
      file: version.file,
      storageType: version.storageType,
    });

    return {
      requestId: request.id,
      recipientId: recipient.id,
      status,
      provider: "NATIVE",
      sourceUrl,
      sourceSha256: request.sourceSha256,
    };
  }

  const session = await ctx.provider.getRecipientSigningSession({
    providerEnvelopeId: request.providerEnvelopeId as string,
    providerRecipientId: Number(recipient.providerRecipientId),
    externalId: request.providerExternalId,
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