// GetRecipientAccessToken: sender-facing minting of a per-recipient invitation
// token, attached to the recipient URL. Called by the sender UI when building
// the shareable signing link. The token is a stateless HMAC binding
// { requestId, recipientId, expiry } — never a DB row and never stored. Its
// lifetime is capped by the request's own expiry.

import type { SigningContext } from "./context";
import {
  SigningNotFoundError,
  SigningStateError,
} from "../domain/signing-errors";
import {
  computeRecipientAccessExpiry,
  mintRecipientAccessToken,
} from "../domain/recipient-access-token";

const NON_MINTABLE_STATUSES: ReadonlySet<string> = new Set([
  "DRAFT",
  "PREPARING",
  "FAILED",
]);

export interface RecipientAccessTokenDTO {
  token: string;
  expiresAt: string;
  recipientId: string;
}

export interface GetRecipientAccessTokenInput {
  teamId: string;
  requestId: string;
  recipientId: string;
}

export async function getRecipientAccessToken(
  ctx: SigningContext,
  input: GetRecipientAccessTokenInput,
): Promise<RecipientAccessTokenDTO> {
  const request = await ctx.requests.findByTeamAndIdWithRecipients(
    input.teamId,
    input.requestId,
  );
  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  const recipient = request.recipients.find(
    (item: any) => item.id === input.recipientId,
  );
  if (!recipient) {
    throw new SigningNotFoundError("Signing recipient was not found.");
  }

  if (NON_MINTABLE_STATUSES.has(request.status)) {
    throw new SigningStateError(
      "Recipient links are available once the request has been sent.",
    );
  }

  const expiresAt = computeRecipientAccessExpiry({
    requestExpiresAt: request.expiresAt,
  });

  const token = mintRecipientAccessToken({
    signatureRequestId: request.id,
    recipientId: recipient.id,
    expiresAt,
  });

  ctx.logger.info("signing.recipient_access_token_minted", {
    requestId: request.id,
    recipientId: recipient.id,
  });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    recipientId: recipient.id,
  };
}
