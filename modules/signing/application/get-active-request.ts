// GetActiveRequest: returns the latest non-terminal signature request for a
// document, or null. Drives the "active request exists" summary in the sender
// UI (never blindly create a second request for a document that is already
// awaiting signatures).

import type { SigningContext } from "./context";
import type { RequestDTO } from "./dto";
import { toRequestDTO } from "./dto";

export interface GetActiveRequestInput {
  teamId: string;
  documentId: string;
}

export async function getActiveRequest(
  ctx: SigningContext,
  input: GetActiveRequestInput,
): Promise<RequestDTO | null> {
  const request = await ctx.requests.findActiveByTeamAndDocument(
    input.teamId,
    input.documentId,
  );

  return request ? toRequestDTO(request) : null;
}
