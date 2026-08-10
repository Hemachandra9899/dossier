// GetSignedArtifact: returns the final signed file if it has been mirrored into
// Dossier-owned storage, otherwise a "pending" DTO. No mirroring happens in
// this checkpoint, so real requests always return pending until the artifact
// mirror job lands.

import type { SigningContext } from "./context";
import type { SignedArtifactDTO } from "./dto";
import { completedArtifactDTO, pendingArtifactDTO } from "./dto";
import { SigningNotFoundError } from "../domain/signing-errors";

export interface GetSignedArtifactInput {
  teamId: string;
  requestId: string;
}

export async function getSignedArtifact(
  ctx: SigningContext,
  input: GetSignedArtifactInput,
): Promise<SignedArtifactDTO> {
  const request = await ctx.requests.findByTeamAndId(
    input.teamId,
    input.requestId,
  );
  if (!request) {
    throw new SigningNotFoundError("Signature request was not found.");
  }

  const artifact = await ctx.requests.findArtifactByRequestId(input.requestId);
  if (!artifact) return pendingArtifactDTO(input.requestId);

  return completedArtifactDTO(input.requestId, artifact);
}
