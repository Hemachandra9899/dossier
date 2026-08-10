// ProcessProviderEvent: maps a provider event contract onto Dossier request
// state. Pure planning logic lives in planProviderEventEffect (unit-testable
// without a database); the use-case loads the request by external id, applies
// the plan, persists the transition and hands off the durable artifact mirror
// when the request completes.

import type { SigningContext, ProviderEventMapper } from "./context";
import type { RequestDTO } from "./dto";
import { toRequestDTO } from "./dto";
import type { SignatureRequestStatus } from "../domain/signature-request";
import { assertCanTransitionTo } from "../domain/state-machine";
import { SigningNotFoundError } from "../domain/signing-errors";

export type ProviderEventEffect = {
  nextStatus: SignatureRequestStatus | null;
  timestampField: "completedAt" | "cancelledAt" | null;
};

/**
 * Pure decision logic: given a raw provider event and the request's current
 * status, returns the status to move to (or null when nothing changes —
 * unknown events or already-applied duplicate events).
 */
export function planProviderEventEffect(input: {
  event: string;
  currentStatus: SignatureRequestStatus;
  mapEventToStatus: ProviderEventMapper;
}): ProviderEventEffect {
  const mapped = input.mapEventToStatus(input.event);
  if (!mapped) return { nextStatus: null, timestampField: null };

  // Duplicate/out-of-order delivery: the event would not change state.
  if (mapped === input.currentStatus) {
    return { nextStatus: null, timestampField: null };
  }

  assertCanTransitionTo(input.currentStatus, mapped);

  const timestampField: ProviderEventEffect["timestampField"] =
    mapped === "COMPLETED"
      ? "completedAt"
      : mapped === "CANCELLED"
        ? "cancelledAt"
        : null;

  return { nextStatus: mapped, timestampField };
}

export interface ProcessProviderEventInput {
  event: string;
  externalId: string;
}

export async function processProviderEvent(
  ctx: SigningContext,
  input: ProcessProviderEventInput,
): Promise<RequestDTO> {
  const request = await ctx.requests.findByProviderExternalId(input.externalId);
  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  // Idempotent re-delivery / retry after a mirror handoff failure: the request
  // is already COMPLETED, so re-drive the mirror handoff and return as-is.
  if (request.status === "COMPLETED") {
    await ctx.artifactMirror.enqueue(request.id);
    return toRequestDTO(request);
  }

  const effect = planProviderEventEffect({
    event: input.event,
    currentStatus: request.status,
    mapEventToStatus: ctx.mapEventToStatus,
  });

  if (!effect.nextStatus) return toRequestDTO(request);

  const timestamps =
    effect.timestampField === "completedAt"
      ? { completedAt: new Date() }
      : effect.timestampField === "cancelledAt"
        ? { cancelledAt: new Date() }
        : {};

  const updated = await ctx.requests.updateStatus(
    request.id,
    effect.nextStatus,
    timestamps,
  );

  ctx.logger.info("signing.provider_event_applied", {
    requestId: updated.id,
    event: input.event,
    from: request.status,
    to: updated.status,
  });

  if (updated.status === "COMPLETED") {
    // Durable handoff (Trigger.dev), not waitUntil: a serverless function
    // dying after "user signed" must never lose the final PDF.
    await ctx.artifactMirror.enqueue(request.id);
  }

  return toRequestDTO(updated);
}
