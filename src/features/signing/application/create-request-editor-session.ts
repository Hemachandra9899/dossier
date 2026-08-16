// CreateRequestEditorSession: returns the embed session a sender opens on the
// full-page prepare screen for a signature request. Mints a fresh Documenso
// presign token for the request's envelope. Opening the editor moves the
// request out of DRAFT into PREPARING (fields are being configured).

import type { SigningContext } from "./context";
import { assertCanTransitionTo } from "../domain/state-machine";
import { SigningStateError } from "../domain/signing-errors";

export interface CreateRequestEditorSessionInput {
  teamId: string;
  requestId: string;
}

export interface EditorSessionDTO {
  provider: "DOCUMENSO";
  host: string;
  presignToken: string;
  envelopeId: string;
  externalId: string;
}

const EDITABLE_STATUSES = new Set(["DRAFT", "PREPARING", "READY"]);

export async function createRequestEditorSession(
  ctx: SigningContext,
  input: CreateRequestEditorSessionInput,
): Promise<EditorSessionDTO> {
  const request = await ctx.requests.findByTeamAndIdWithRecipients(
    input.teamId,
    input.requestId,
  );

  if (!EDITABLE_STATUSES.has(request.status)) {
    throw new SigningStateError(
      `Request is not editable for field authoring (status: ${request.status}).`,
    );
  }

  if (!request.providerEnvelopeId) {
    throw new SigningStateError(
      "Request has not been initialized with the signing provider.",
    );
  }

  if (request.status === "DRAFT") {
    assertCanTransitionTo("DRAFT", "PREPARING");
    await ctx.requests.updateStatus(request.id, "PREPARING");
  }

  const session = await ctx.provider.createEditorSessionForEnvelope({
    providerEnvelopeId: request.providerEnvelopeId,
    externalId: request.providerExternalId,
  });

  return {
    provider: "DOCUMENSO",
    host: session.host,
    presignToken: session.presignToken,
    envelopeId: session.envelopeId,
    externalId: session.externalId,
  };
}
