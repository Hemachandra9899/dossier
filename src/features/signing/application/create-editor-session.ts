// CreateEditorSession: returns the embed session a field author opens on the
// provider. The template must be READY and provider-initialized (carry a
// providerTemplateId + providerEnvelopeId).

import type { SigningContext } from "./context";
import type { ProviderTemplate } from "../providers/signing-provider";
import { SigningNotFoundError, SigningStateError } from "../domain/signing-errors";

export interface CreateEditorSessionInput {
  teamId: string;
  templateId: string;
}

export interface EditorSessionDTO {
  templateId: string;
  provider: "DOCUMENSO";
  host: string;
  presignToken: string;
  envelopeId: string;
  externalId: string;
}

export async function createEditorSession(
  ctx: SigningContext,
  input: CreateEditorSessionInput,
): Promise<EditorSessionDTO> {
  const template = await ctx.templates.findByTeamAndId(
    input.teamId,
    input.templateId,
  );

  if (!template) {
    throw new SigningNotFoundError("Signature template was not found.");
  }

  if (template.status !== "READY") {
    throw new SigningStateError(
      `Template is not ready for field authoring (status: ${template.status}).`,
    );
  }

  if (!template.providerTemplateId || !template.providerEnvelopeId) {
    throw new SigningStateError(
      "Template has not been initialized with the signing provider.",
    );
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
