// GetPublicRequest: access-proofed, recipient-safe request lookup for the
// public signing page. Never returns team, provider or storage data — only the
// minimum a verified recipient needs to see the document name, their own name
// and the current lifecycle gates.

import type { SigningContext } from "./context";
import { SigningNotFoundError } from "../domain/signing-errors";

/** Statuses a verified recipient is allowed to see. */
export type PublicRecipientStatus =
  | "READY"
  | "SENT"
  | "VIEWED"
  | "SIGNING"
  | "PARTIALLY_SIGNED"
  | "COMPLETED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

export type PublicSignatureRequest = {
  id: string;
  document: { name: string };
  recipient: { name: string | null };
  status: PublicRecipientStatus;
  expiresAt: string | null;
  completedAt: string | null;
  canSign: boolean;
  canDownloadSignedCopy: boolean;
};

export interface GetPublicRequestInput {
  requestId: string;
  recipientId: string;
}

const SIGNABLE_STATUSES: ReadonlySet<string> = new Set([
  "READY",
  "SENT",
  "VIEWED",
  "SIGNING",
  "PARTIALLY_SIGNED",
]);

/** Sender-internal states are never surfaced to a recipient. */
const NON_VISIBLE_STATUSES: ReadonlySet<string> = new Set([
  "DRAFT",
  "PREPARING",
  "FAILED",
]);

export async function getPublicRequest(
  ctx: SigningContext,
  input: GetPublicRequestInput,
): Promise<PublicSignatureRequest> {
  const request = await ctx.requests.findByIdForRecipient(input.requestId);
  if (!request || !request.document) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  // Draft/preparing/failed requests have no business being opened by a
  // recipient even with a valid token.
  if (NON_VISIBLE_STATUSES.has(request.status)) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  const recipient = request.recipients.find(
    (item: any) => item.id === input.recipientId,
  );
  if (!recipient) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  const isExpired =
    !!request.expiresAt &&
    request.expiresAt.getTime() <= Date.now() &&
    request.status !== "EXPIRED";

  return {
    id: request.id,
    document: { name: request.document.name },
    recipient: { name: recipient.name },
    status: request.status as PublicRecipientStatus,
    expiresAt: request.expiresAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    canSign: SIGNABLE_STATUSES.has(request.status) && !isExpired,
    canDownloadSignedCopy: request.status === "COMPLETED",
  };
}
