// CreateTemplate: provisions a signature template for a PDF document.
//
// 1. Verify document ownership + usability (PDF).
// 2. Create the SignatureTemplate locally as PREPARING with a deterministic
//    external id.
// 3. Retrieve the stored document file through the storage port.
// 4. Call SigningProvider.createTemplate.
// 5. Persist provider ids and move PREPARING -> READY.
// 6. On provider failure: keep the local record, move it to FAILED and log.

import type { SigningContext } from "./context";
import type { SignatureTemplateStatus } from "../domain/signature-template";
import {
  SigningProviderError,
  SigningValidationError,
} from "../domain/signing-errors";

export interface CreateTemplateInput {
  actor: { userId: string; teamId: string };
  documentId: string;
  name: string;
}

export interface CreateTemplateResult {
  template: {
    id: string;
    name: string;
    status: SignatureTemplateStatus;
    providerExternalId: string;
    providerTemplateId: string | null;
    providerEnvelopeId: string | null;
    documentId: string;
  };
}

export async function createTemplate(
  ctx: SigningContext,
  input: CreateTemplateInput,
): Promise<CreateTemplateResult> {
  const name = input.name.trim();
  if (!name) {
    throw new SigningValidationError("Template name is required.");
  }

  const document = await ctx.documents.findForTemplateUpload(
    input.actor.teamId,
    input.documentId,
  );

  // Local row first (PREPARING) so a provider failure is never a lost request.
  const template = await ctx.templates.createWithExternalId({
    teamId: input.actor.teamId,
    documentId: document.id,
    name,
  });

  try {
    const file = await ctx.getDocumentFileBytes({
      file: document.file,
      storageType: document.storageType,
    });

    const providerTemplate = await ctx.provider.createTemplate({
      title: template.name,
      externalId: template.providerExternalId,
      fileName: `${template.name}.pdf`,
      file,
    });

    const updated = await ctx.templates.update(template.id, {
      status: "READY",
      providerTemplateId: providerTemplate.templateId,
      providerEnvelopeId: providerTemplate.envelopeId,
    });

    ctx.logger.info("signing.template_ready", {
      teamId: updated.teamId,
      templateId: updated.id,
      providerTemplateId: updated.providerTemplateId,
    });

    return {
      template: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        providerExternalId: updated.providerExternalId,
        providerTemplateId: updated.providerTemplateId,
        providerEnvelopeId: updated.providerEnvelopeId,
        documentId: updated.documentId,
      },
    };
  } catch (error) {
    await ctx.templates.update(template.id, { status: "FAILED" });

    ctx.logger.error(
      "signing.template_provider_failed",
      { teamId: template.teamId, templateId: template.id },
      error,
    );

    throw new SigningProviderError(
      "The signing provider could not initialize the template.",
      { cause: error },
    );
  }
}
