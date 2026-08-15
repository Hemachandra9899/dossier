// Signing request state machine. Transitions are enforced in the application
// layer (never in Prisma). The table below is the single source of truth for
// which status changes are legal.
//
// NOTE: `DECLINED` has no explicit rows in the table because it is reachable
// only through provider-forced events (DOCUMENT_REJECTED). `assertCanTransitionTo`
// therefore admits `-> DECLINED` from any non-terminal state; the table itself
// is kept minimal on purpose and will be expanded when we wire the real flow.

import {
  isSignatureRequestTerminal,
  type SignatureRequestStatus,
} from "./signature-request";
import { SigningStateError } from "./signing-errors";

export const SIGNING_STATE_TRANSITIONS: Record<
  SignatureRequestStatus,
  ReadonlyArray<SignatureRequestStatus>
> = {
  DRAFT: ["PREPARING"],
  PREPARING: ["READY", "FAILED"],
  READY: ["SENT", "VIEWED", "SIGNING", "PARTIALLY_SIGNED", "CANCELLED", "EXPIRED"],
  SENT: ["VIEWED", "SIGNING", "PARTIALLY_SIGNED", "CANCELLED", "EXPIRED"],
  VIEWED: ["SIGNING", "PARTIALLY_SIGNED", "CANCELLED", "EXPIRED"],
  SIGNING: ["PARTIALLY_SIGNED", "COMPLETED", "CANCELLED", "EXPIRED"],
  PARTIALLY_SIGNED: ["COMPLETED", "CANCELLED", "EXPIRED"],
  COMPLETED: [],
  DECLINED: [],
  EXPIRED: [],
  CANCELLED: [],
  FAILED: [],
};

/**
 * True when the machine allows `from -> to`. Rejects with `SigningStateError`
 * otherwise.
 */
export function assertCanTransitionTo(
  from: SignatureRequestStatus,
  to: SignatureRequestStatus,
): void {
  const allowed = SIGNING_STATE_TRANSITIONS[from];
  if (allowed.includes(to)) return;

  // Provider-forced terminal cut: a rejection may terminate a request from any
  // non-terminal state. Kept out of the table because it is not a user/flow
  // transition, but is a legal outcome of DOCUMENT_REJECTED.
  if (to === "DECLINED" && !isSignatureRequestTerminal(from)) return;

  throw new SigningStateError(
    `Invalid signing state transition: ${from} -> ${to}`,
  );
}

export function canTransitionTo(
  from: SignatureRequestStatus,
  to: SignatureRequestStatus,
): boolean {
  try {
    assertCanTransitionTo(from, to);
    return true;
  } catch {
    return false;
  }
}
