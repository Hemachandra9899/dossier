// CreateDraft: provisions a signature request draft and its recipients.
//
// The sender flow is: pick recipients -> create a DRAFT request -> open the
// full-page editor to place fields -> send. This use-case only creates the
// draft:
//
// 1. Validate recipients (at least one, emails normalized, no duplicates).
// 2. Verify the document is signable and has no active request already.
// 3. Create the SignatureRequest as DRAFT + recipients (no template row; the
//    envelope flow owns one DOCUMENT envelope per request).
// 4. Create ONE provider envelope with the request's real recipients and
//    persist providerEnvelopeId + per-recipient providerRecipientIds so the
//    editor assigns fields per recipient.
// 5. On provider failure: keep the local rows and move them to FAILED.

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

  // Local request + recipients first (DRAFT). No provider call happens during
  // the create so a provider failure keeps a consistent local record.
  const request = await ctx.requests.createWithRecipients({
    teamId: input.actor.teamId,
    documentId: document.id,
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

    // ONE DOCUMENT envelope for the whole request; all signers are recipients
    // on it. `distributionMethod: "NONE"` guarantees Documenso never emails —
    // Dossier owns every invitation.
    const created = await ctx.provider.createEnvelope({
      title: document.name,
      externalId: request.providerExternalId,
      fileName: `${document.name}.pdf`,
      file,
      recipients: recipients.map((recipient) => ({
        email: recipient.email,
        name: recipient.name,
        signingOrder: recipient.signingOrder,
      })),
    });

    await ctx.requests.updateProviderIds(request.id, {
      providerEnvelopeId: created.providerEnvelopeId,
    });

    for (const recipient of request.recipients) {
      const match = created.recipients.find(
        (item) => item.email === recipient.email,
      );
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
      envelopeId: created.providerEnvelopeId,
      recipientCount: draft.recipients.length,
    });

    return { request: toRequestDTO(draft) };
  } catch (error) {
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
