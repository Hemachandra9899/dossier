// GetRequest: reads a signature request with its recipients, scoped to a team.

import type { SigningContext } from "./context";
import type { RequestDTO } from "./dto";
import { toRequestDTO } from "./dto";
import { SigningNotFoundError } from "../domain/signing-errors";

export interface GetRequestInput {
  teamId: string;
  requestId: string;
}

export async function getRequest(
  ctx: SigningContext,
  input: GetRequestInput,
): Promise<RequestDTO> {
  const request = await ctx.requests.findByTeamAndIdWithRecipients(
    input.teamId,
    input.requestId,
  );

  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  return toRequestDTO(request);
}
