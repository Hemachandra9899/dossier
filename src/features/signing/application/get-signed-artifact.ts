import type { SigningContext } from "./context";
import type { SignedArtifactDTO } from "./dto";
import { completedArtifactDTO, pendingArtifactDTO } from "./dto";
import { SigningNotFoundError } from "../domain/signing-errors";
import { getFile } from "@/shared/utils/files/get-file";
import { buildContentDisposition } from "@/shared/utils/utils";

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

  const downloadUrl = await getFile({
    type: "S3_PATH",
    data: artifact.storageKey,
    isDownload: true,
    responseContentDisposition: buildContentDisposition(
      artifact.fileName,
      artifact.fileName,
    ),
  });

  return {
    ...completedArtifactDTO(input.requestId, artifact),
    downloadUrl,
  };
}
