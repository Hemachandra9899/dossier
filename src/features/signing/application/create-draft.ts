// CreateDraft: provisions a signature request draft and its recipients.
//
// The sender flow is: pick recipients -> create a DRAFT request -> open the
// full-page editor to place fields -> send. This use-case only creates the
// draft:
//
// 1. Validate recipients (at least one, emails normalized, no duplicates).
// 2. Verify the document is signable and has no active request already.
// 3. Create the SignatureTemplate locally (PREPARING) with a deterministic
//    external id, upload it to the provider, move it to READY.
// 4. Create the SignatureRequest as DRAFT + recipients.
// 5. Replace the provider template's placeholder recipient with the request's
//    real recipients (so the editor assigns fields per recipient) and persist
//    providerEnvelopeId + per-recipient providerRecipientIds.
// 6. On provider failure: keep the local rows and move them to FAILED.

import type { SigningContext } from "./context";
import type { RequestDTO } from "./dto";
import { toRequestDTO } from "./dto";
import { validateAndNormalizeRecipients } from "../domain/recipient-validation";
import {
  SigningProviderError,
  SigningStateError,
  SigningValidationError,
} from "../domain/signing-errors";

export interface CreateDraftInput {
  actor: { userId: string; teamId: string };
  documentId: string;
  recipients: unknown;
  expiresAt?: string | null;
  dossierFileId?: string | null;
}

export interface CreateDraftResult {
  request: RequestDTO;
}

export async function createDraft(
  ctx: SigningContext,
  input: CreateDraftInput,
): Promise<CreateDraftResult> {
  const recipients = validateAndNormalizeRecipients(input.recipients);

  const document = await ctx.documents.findForTemplateUpload(
    input.actor.teamId,
    input.documentId,
  );

  const existing = await ctx.requests.findActiveByTeamAndDocument(
    input.actor.teamId,
    input.documentId,
  );
  if (existing) {
    throw new SigningStateError(
      "This document already has an active signature request.",
    );
  }

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new SigningValidationError("expiresAt must be a valid date.");
  }

  // Local template row first (PREPARING) so a provider failure never loses the
  // draft. One template per draft; the request hangs off it.
  const template = await ctx.templates.createWithExternalId({
    teamId: input.actor.teamId,
    documentId: document.id,
    name: document.name,
  });

  // Local request + recipients next (DRAFT). No provider call happens between
  // the two creates so a provider failure keeps a consistent local record.
  const request = await ctx.requests.createWithRecipients({
    teamId: input.actor.teamId,
    documentId: document.id,
    templateId: template.id,
    expiresAt,
    recipients,
    dossierFileId: input.dossierFileId,
    status: "DRAFT",
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

    await ctx.templates.update(template.id, {
      status: "READY",
      providerTemplateId: providerTemplate.templateId,
      providerEnvelopeId: providerTemplate.envelopeId,
    });

    await ctx.requests.updateProviderIds(request.id, {
      providerEnvelopeId: providerTemplate.envelopeId,
    });

    const synced = await ctx.provider.syncRecipientsToEnvelope({
      providerTemplateId: providerTemplate.templateId,
      providerEnvelopeId: providerTemplate.envelopeId,
      recipients: recipients.map((recipient) => ({
        email: recipient.email,
        name: recipient.name,
        signingOrder: recipient.signingOrder,
      })),
    });

    for (const recipient of request.recipients) {
      const match = synced.find((item) => item.email === recipient.email);
      if (!match) {
        throw new SigningProviderError(
          `The signing provider did not return a recipient id for ${recipient.email}.`,
        );
      }
      await ctx.requests.updateRecipientProviderIds(recipient.id, {
        providerRecipientId: match.providerRecipientId,
      });
    }

    await ctx.requests.createActivity({
      signatureRequestId: request.id,
      type: "REQUEST_CREATED",
    });

    const draft = await ctx.requests.findById(request.id);

    ctx.logger.info("signing.draft_created", {
      teamId: draft.teamId,
      requestId: draft.id,
      documentId: draft.documentId,
      recipientCount: draft.recipients.length,
    });

    return { request: toRequestDTO(draft) };
  } catch (error) {
    await ctx.templates.update(template.id, { status: "FAILED" });
    await ctx.requests.updateStatus(request.id, "FAILED");

    ctx.logger.error(
      "signing.draft_provider_failed",
      { teamId: request.teamId, requestId: request.id },
      error,
    );

    throw new SigningProviderError(
      "The signing provider could not initialize the request draft.",
      { cause: error },
    );
  }
}
