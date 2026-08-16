// ExchangeRecipientAccessToken: swaps the long-lived invitation token (present
// in the recipient URL) for proof that the exchange may proceed. The route
// layer turns the verified token into a short-lived HttpOnly cookie; the URL's
// long-lived secret is then scrubbed from the browser history. Enforces that
// the request still exists, is recipient-visible, and has not expired.

import type { SigningContext } from "./context";
import {
  SigningNotFoundError,
  SigningValidationError,
} from "../domain/signing-errors";
import { parseRecipientAccessToken } from "../domain/recipient-access-token";

const NON_VISIBLE_STATUSES: ReadonlySet<string> = new Set([
  "DRAFT",
  "PREPARING",
  "FAILED",
]);

export interface ExchangeRecipientAccessTokenInput {
  requestId: string;
  token: string;
}

export interface ExchangeRecipientAccessTokenResult {
  ok: true;
  recipientId: string;
  expiresAt: Date;
}

export async function exchangeRecipientAccessToken(
  ctx: SigningContext,
  input: ExchangeRecipientAccessTokenInput,
): Promise<ExchangeRecipientAccessTokenResult> {
  const parsed = parseRecipientAccessToken(input.token);
  if (!parsed || parsed.signatureRequestId !== input.requestId) {
    throw new SigningValidationError(
      "This signing link is invalid or expired. Ask the sender for a fresh link.",
    );
  }

  if (parsed.expiresAt.getTime() <= Date.now()) {
    throw new SigningValidationError(
      "This signing link is invalid or expired. Ask the sender for a fresh link.",
    );
  }

  const request = await ctx.requests.findByIdForRecipient(input.requestId);
  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }
  if (NON_VISIBLE_STATUSES.has(request.status)) {
    throw new SigningNotFoundError("Signature request was not found.");
  }
  if ((request.status as string) === "CANCELLED") {
    throw new SigningValidationError(
      "This signature request has been cancelled by the sender.",
    );
  }
  if ((request.status as string) === "EXPIRED") {
    throw new SigningValidationError(
      "This signature request has expired.",
    );
  }

  // Request-level expiry: a link cannot open a request that has lapsed.
  if (
    request.expiresAt &&
    request.expiresAt.getTime() <= Date.now() &&
    (request.status as string) !== "EXPIRED"
  ) {
    throw new SigningValidationError(
      "This signature request has expired.",
    );
  }

  // Update recipient status to VIEWED and log activity
  const recipient = request.recipients.find((r: any) => r.id === parsed.recipientId);
  if (recipient) {
    if (recipient.status === "PENDING") {
      await ctx.recipients.updateStatus(recipient.id, "VIEWED", { viewedAt: new Date() });
      if (request.status === "SENT") {
        await ctx.requests.updateStatus(request.id, "VIEWED", { viewedAt: new Date() });
      }
    }

    const { default: prisma } = await import("@/platform/db");
    const exists = await prisma.signatureActivity.findFirst({
      where: {
        signatureRequestId: request.id,
        recipientId: recipient.id,
        type: "RECIPIENT_VIEWED",
      },
    });
    if (!exists) {
      await ctx.activities.create({
        signatureRequestId: request.id,
        recipientId: recipient.id,
        type: "RECIPIENT_VIEWED",
      });
    }
  }

  return { ok: true, recipientId: parsed.recipientId, expiresAt: parsed.expiresAt };
}
