// CreateRequestEditorSession: returns the embed session a sender opens on the
// full-page prepare screen for a signature request. Resolves the request's
// template and mints a fresh Documenso presign token. Opening the editor moves
// the request out of DRAFT into PREPARING (fields are being configured).

import type { SigningContext } from "./context";
import type { ProviderTemplate } from "../providers/signing-provider";
import { assertCanTransitionTo } from "../domain/state-machine";
import { SigningStateError } from "../domain/signing-errors";

export interface CreateRequestEditorSessionInput {
  teamId: string;
  requestId: string;
}

export interface EditorSessionDTO {
  templateId: string;
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

  const template = await ctx.templates.findById(request.templateId);

  if (!template || template.status !== "READY") {
    throw new SigningStateError(
      `Template is not ready for field authoring (status: ${template.status ?? "missing"}).`,
    );
  }

  if (!template.providerTemplateId || !template.providerEnvelopeId) {
    throw new SigningStateError(
      "Template has not been initialized with the signing provider.",
    );
  }

  if (request.status === "DRAFT") {
    assertCanTransitionTo("DRAFT", "PREPARING");
    await ctx.requests.updateStatus(request.id, "PREPARING");
  }

  const providerTemplate: ProviderTemplate = {
    provider: "DOCUMENSO",
    templateId: template.providerTemplateId,
    envelopeId: template.providerEnvelopeId,
    externalId: template.providerExternalId,
  };

  const session = await ctx.provider.createEditorSession(providerTemplate);

  return {
    templateId: template.id,
    provider: "DOCUMENSO",
    host: session.host,
    presignToken: session.presignToken,
    envelopeId: session.envelopeId,
    externalId: session.externalId,
  };
}
