// CompleteRequest: idempotently completes a signature request. Legal only from
// SIGNING / PARTIALLY_SIGNED; already-completed requests return as-is.

import type { SigningContext } from "./context";
import type { RequestDTO } from "./dto";
import { toRequestDTO } from "./dto";
import { assertCanTransitionTo } from "../domain/state-machine";
import { SigningNotFoundError } from "../domain/signing-errors";

export interface CompleteRequestInput {
  teamId: string;
  requestId: string;
}

export async function completeRequest(
  ctx: SigningContext,
  input: CompleteRequestInput,
): Promise<RequestDTO> {
  const request = await ctx.requests.findByTeamAndIdWithRecipients(
    input.teamId,
    input.requestId,
  );

  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  if (request.status === "COMPLETED") {
    return toRequestDTO(request);
  }

  assertCanTransitionTo(request.status, "COMPLETED");

  const updated = await ctx.requests.updateStatus(request.id, "COMPLETED", {
    completedAt: new Date(),
  });

  ctx.logger.info("signing.request_completed", {
    teamId: updated.teamId,
    requestId: updated.id,
  });

  return toRequestDTO(updated);
}
