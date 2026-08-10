// CancelRequest: moves a non-terminal request to CANCELLED (terminal).
// Idempotent: cancelling an already-cancelled request is a no-op. The provider
// envelope is cancelled best-effort — the local transition always completes so
// a provider outage can never strand a request in a cancellable state.

import type { SigningContext } from "./context";
import type { RequestDTO } from "./dto";
import { toRequestDTO } from "./dto";
import { assertCanTransitionTo } from "../domain/state-machine";
import { SigningNotFoundError } from "../domain/signing-errors";

export interface CancelRequestInput {
  teamId: string;
  requestId: string;
}

export async function cancelRequest(
  ctx: SigningContext,
  input: CancelRequestInput,
): Promise<RequestDTO> {
  const request = await ctx.requests.findByTeamAndIdWithRecipients(
    input.teamId,
    input.requestId,
  );

  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  if (request.status === "CANCELLED") {
    return toRequestDTO(request);
  }

  assertCanTransitionTo(request.status, "CANCELLED");

  if (request.providerEnvelopeId) {
    try {
      await ctx.provider.cancelRequest({
        providerEnvelopeId: request.providerEnvelopeId,
      });
    } catch (error) {
      ctx.logger.warn("signing.provider_cancel_failed", {
        requestId: request.id,
        providerEnvelopeId: request.providerEnvelopeId,
      }, error);
    }
  }

  const updated = await ctx.requests.updateStatus(request.id, "CANCELLED", {
    cancelledAt: new Date(),
  });

  ctx.logger.info("signing.request_cancelled", {
    teamId: updated.teamId,
    requestId: updated.id,
  });

  return toRequestDTO(updated);
}
