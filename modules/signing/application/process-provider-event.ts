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
import prisma from "@/lib/prisma";
import { getEnvelope } from "@/lib/signing/envelopes";
import { mapDocumensoRecipientStatusToStatus } from "../provider/documenso/mapper";

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

  // Fetch envelope to sync recipients
  if (request.providerEnvelopeId) {
    try {
      const envelope = await getEnvelope(request.providerEnvelopeId);
      if (envelope && Array.isArray(envelope.recipients)) {
        for (const provRecipient of envelope.recipients) {
          const localRecipient = request.recipients.find(
            (r) => r.email?.toLowerCase() === provRecipient.email?.toLowerCase()
          );
          if (localRecipient) {
            const nextRecipientStatus = mapDocumensoRecipientStatusToStatus((provRecipient as any).status);
            if (nextRecipientStatus && nextRecipientStatus !== localRecipient.status) {
              const extra =
                nextRecipientStatus === "SIGNED"
                  ? { signedAt: new Date() }
                  : nextRecipientStatus === "VIEWED"
                    ? { viewedAt: new Date() }
                    : {};
              await ctx.requests.updateRecipientStatus(localRecipient.id, nextRecipientStatus, extra);

              // Log recipient timeline activity
              let activityType: any = null;
              if (nextRecipientStatus === "SIGNED") {
                activityType = "RECIPIENT_SIGNED";
              } else if (nextRecipientStatus === "VIEWED") {
                activityType = "RECIPIENT_VIEWED";
              } else if (nextRecipientStatus === "SIGNING") {
                activityType = "SIGNING_STARTED";
              }

              if (activityType) {
                // Ensure no duplicate activities of the same type for this recipient
                const exists = await prisma.signatureActivity.findFirst({
                  where: {
                    signatureRequestId: request.id,
                    recipientId: localRecipient.id,
                    type: activityType,
                  },
                });
                if (!exists) {
                  await ctx.requests.createActivity({
                    signatureRequestId: request.id,
                    recipientId: localRecipient.id,
                    type: activityType,
                  });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      ctx.logger.warn("signing.sync_recipients_failed", { requestId: request.id }, err);
    }
  }

  if (!effect.nextStatus) {
    const refreshed = await ctx.requests.findByIdWithRecipients(request.id);
    return toRequestDTO(refreshed ?? request);
  }

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

  // Log request timeline activity
  let reqActivityType: any = null;
  if (effect.nextStatus === "COMPLETED") {
    reqActivityType = "REQUEST_COMPLETED";
  } else if (effect.nextStatus === "CANCELLED") {
    reqActivityType = "REQUEST_CANCELLED";
  }

  if (reqActivityType) {
    const exists = await prisma.signatureActivity.findFirst({
      where: {
        signatureRequestId: request.id,
        type: reqActivityType,
      },
    });
    if (!exists) {
      await ctx.requests.createActivity({
        signatureRequestId: request.id,
        type: reqActivityType,
      });
    }
  }

  ctx.logger.info("signing.provider_event_applied", {
    requestId: updated.id,
    event: input.event,
    from: request.status,
    to: updated.status,
  });

  if (updated.status === "COMPLETED") {
    // 1. Trigger the completion email
    const { deliverCompletionEmail } = await import("./deliver-signature-request");
    await deliverCompletionEmail(ctx, updated.id).catch((err) => {
      ctx.logger.error("signing.deliver_completion_failed", { requestId: updated.id }, err);
    });

    // 2. Durable handoff (Trigger.dev) for mirroring final signed PDF
    await ctx.artifactMirror.enqueue(request.id);
  }

  const finalRefreshed = await ctx.requests.findByIdWithRecipients(request.id);
  return toRequestDTO(finalRefreshed ?? updated);
}
