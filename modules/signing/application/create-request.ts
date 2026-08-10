// CreateRequest: provisions a signature request and its recipients.
//
// 1. Validate recipients (at least one, emails normalized, no duplicates).
// 2. Verify template ownership/team + template.documentId match + READY.
// 3. Create request + recipients in one local transaction (PREPARING) with a
//    deterministic external id.
// 4. Call SigningProvider.createSigningDocument (no emails sent by provider).
// 5. Persist provider ids (request + per-recipient) and move to READY.
// 6. On provider failure: keep the local record, move it to FAILED and log.

import type { SigningContext } from "./context";
import type { SignatureRequestStatus } from "../domain/signature-request";
import { validateAndNormalizeRecipients } from "../domain/recipient-validation";
import {
  SigningNotFoundError,
  SigningProviderError,
  SigningStateError,
  SigningValidationError,
} from "../domain/signing-errors";

export interface CreateRequestInput {
  actor: { userId: string; teamId: string };
  documentId: string;
  templateId: string;
  recipients: unknown;
  expiresAt?: string | null;
}

export interface CreateRequestResult {
  requestId: string;
  status: SignatureRequestStatus;
}

export async function createRequest(
  ctx: SigningContext,
  input: CreateRequestInput,
): Promise<CreateRequestResult> {
  const recipients = validateAndNormalizeRecipients(input.recipients);

  const template = await ctx.templates.findByTeamAndId(
    input.actor.teamId,
    input.templateId,
  );
  if (!template) {
    throw new SigningNotFoundError("Signature template was not found.");
  }
  if (template.status !== "READY") {
    throw new SigningStateError(
      `Template is not ready for signing (status: ${template.status}).`,
    );
  }
  if (template.documentId !== input.documentId) {
    throw new SigningValidationError(
      "Signature template does not belong to the selected document.",
    );
  }

  await ctx.documents.findSignableByTeamAndId(
    input.actor.teamId,
    input.documentId,
  );

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new SigningValidationError("expiresAt must be a valid date.");
  }

  // Local request + recipients first (PREPARING); provider init happens after
  // so a provider failure is never a lost request.
  const request = await ctx.requests.createWithRecipients({
    teamId: input.actor.teamId,
    documentId: input.documentId,
    templateId: template.id,
    expiresAt,
    recipients,
  });

  try {
    if (!template.providerTemplateId) {
      throw new SigningStateError(
        "Template has not been initialized with the signing provider.",
      );
    }

    const providerDocument = await ctx.provider.createSigningDocument({
      providerTemplateId: template.providerTemplateId,
      externalId: request.providerExternalId,
      recipients: recipients.map((recipient) => ({
        name: recipient.name,
        email: recipient.email,
        signingOrder: recipient.signingOrder,
      })),
    });

    await ctx.requests.updateProviderIds(request.id, {
      providerEnvelopeId: providerDocument.providerEnvelopeId,
      providerDocumentId: providerDocument.providerDocumentId,
    });

    for (let index = 0; index < request.recipients.length; index++) {
      const providerIds = providerDocument.recipients[index];
      if (!providerIds) {
        throw new SigningProviderError(
          "The signing provider returned fewer documents than recipients.",
        );
      }
      await ctx.requests.updateRecipientProviderIds(
        request.recipients[index].id,
        providerIds,
      );
    }

    const ready = await ctx.requests.updateStatus(request.id, "READY");

    ctx.logger.info("signing.request_ready", {
      teamId: ready.teamId,
      requestId: ready.id,
      templateId: ready.templateId,
      documentId: ready.documentId,
      recipientCount: ready.recipients.length,
    });

    return { requestId: ready.id, status: ready.status };
  } catch (error) {
    await ctx.requests.updateStatus(request.id, "FAILED");

    ctx.logger.error(
      "signing.request_provider_failed",
      { teamId: request.teamId, requestId: request.id },
      error,
    );

    throw new SigningProviderError(
      "The signing provider could not initialize the request.",
      { cause: error },
    );
  }
}
