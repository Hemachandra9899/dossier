// CreateDraft: provisions a signature request draft and its recipients.
//
// The sender flow is: pick recipients -> create a DRAFT request -> open the
// full-page editor to place fields -> send. This use-case only creates the
// draft:
//
// 1. Validate recipients (at least one, emails normalized, no duplicates).
// 2. Verify the document is signable and has no active request already.
// 3. Pin the exact document version being signed + hash the source bytes so a
//    newer upload never silently changes the PDF the signer sees.
// 4. Create the SignatureRequest (DRAFT) + recipients.
//    - NATIVE: the request owns its whole lifecycle; no external envelope is
//      created. Fields are authored directly against the pinned source PDF.
//    - DOCUMENSO: additionally create ONE provider envelope and persist the
//      provider envelope/recipient ids so the Documenso editor can assign
//      fields per recipient.
// 5. On provider failure: keep the local rows and move them to FAILED.

import { createHash } from "node:crypto";

import type { SigningContext } from "./context";
import type { RequestDTO } from "./dto";
import { toRequestDTO } from "./dto";
import { validateAndNormalizeRecipients } from "../domain/recipient-validation";
import { getActiveSigningProvider } from "../config";
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

  const engine = getActiveSigningProvider();
  const provider = engine === "DOCUMENSO" ? "DOCUMENSO" : "NATIVE";

  const file = await ctx.getDocumentFileBytes({
    file: document.file,
    storageType: document.storageType,
  });

  // Hash the exact source bytes being signed. Stored against the request so the
  // finalizer can prove the finalized PDF was built from this source and
  // nothing silently swapped underneath the signer.
  const sourceSha256 = createHash("sha256").update(file).digest("hex");

  const request = await ctx.requests.createWithRecipients({
    teamId: input.actor.teamId,
    documentId: document.id,
    documentVersionId: document.versionId,
    sourceSha256,
    provider,
    expiresAt,
    recipients,
    dossierFileId: input.dossierFileId,
    status: "DRAFT",
  });

  await ctx.activities.create({
    signatureRequestId: request.id,
    type: "REQUEST_CREATED",
  });

  if (engine === "NATIVE") {
    const draft = await ctx.requests.findById(request.id);

    ctx.logger.info("signing.draft_created", {
      teamId: draft.teamId,
      requestId: draft.id,
      documentId: draft.documentId,
      engine: "NATIVE",
      recipientCount: draft.recipients.length,
    });

    return { request: toRequestDTO(draft) };
  }

  try {
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
      await ctx.recipients.updateProviderIds(recipient.id, {
        providerRecipientId: match.providerRecipientId,
      });
    }

    const draft = await ctx.requests.findById(request.id);

    ctx.logger.info("signing.draft_created", {
      teamId: draft.teamId,
      requestId: draft.id,
      documentId: draft.documentId,
      envelopeId: created.providerEnvelopeId,
      engine: "DOCUMENSO",
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
