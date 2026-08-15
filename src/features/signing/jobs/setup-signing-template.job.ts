import { DocumentStorageType } from "@prisma/client";
import { AbortTaskRunError, logger, metadata, task } from "@trigger.dev/sdk";

import { ONE_HOUR } from "@/shared/utils/constants";
import { getFile } from "@/shared/utils/files/get-file";
import prisma from "@/platform/db";
import {
  buildAgreementSigningExternalId,
  createSigningTemplateEnvelope,
  ensureTeamSigningFolders,
  isSigningAgreement,
} from "@/shared/utils/signing/agreements";
import {
  MAX_SIGNING_TEMPLATE_PDF_BYTES,
  getSigningTemplateTooLargeMessage,
} from "@/shared/utils/signing/template-upload";
import { signingTemplateSetupQueue } from "@/platform/queue/trigger/queues";

type SetupSigningTemplatePayload = {
  agreementId: string;
  teamId: string;
  file: {
    fileName: string;
    data: string;
    storageType: DocumentStorageType;
    fileSize: number;
  };
};

type SetupStatus = {
  progress: number;
  text: string;
};

const setStatus = (status: SetupStatus) => {
  metadata.set("status", status);
};

export const setupSigningTemplateTask = task({
  id: "setup-signing-template",
  queue: signingTemplateSetupQueue,
  retry: { maxAttempts: 2 },
  run: async (payload: SetupSigningTemplatePayload) => {
    setStatus({ progress: 0, text: "Initializing signing template..." });

    if (payload.file.fileSize > MAX_SIGNING_TEMPLATE_PDF_BYTES) {
      throw new AbortTaskRunError(getSigningTemplateTooLargeMessage());
    }

    const agreement = await prisma.agreement.findFirst({
      where: {
        id: payload.agreementId,
        teamId: payload.teamId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        contentType: true,
        signingProvider: true,
        signingExternalId: true,
        signingEnvelopeId: true,
      },
    });

    if (!agreement) {
      throw new AbortTaskRunError("Agreement not found.");
    }

    if (!isSigningAgreement(agreement)) {
      throw new AbortTaskRunError(
        "Only embedded signing agreements can attach a PDF template.",
      );
    }

    if (agreement.signingEnvelopeId) {
      throw new AbortTaskRunError(
        "This agreement is already linked to a signing template.",
      );
    }

    setStatus({ progress: 15, text: "Retrieving uploaded PDF..." });

    const fileUrl = await getFile({
      type: payload.file.storageType,
      data: payload.file.data,
      expiresIn: ONE_HOUR,
    });

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      logger.error("Failed to fetch signing template PDF", {
        status: fileResponse.status,
        agreementId: payload.agreementId,
        teamId: payload.teamId,
      });
      throw new AbortTaskRunError("Failed to retrieve uploaded PDF.");
    }

    const pdfBuffer = Buffer.from(await fileResponse.arrayBuffer());
    if (pdfBuffer.length === 0) {
      throw new AbortTaskRunError("The uploaded PDF is empty.");
    }

    if (pdfBuffer.length > MAX_SIGNING_TEMPLATE_PDF_BYTES) {
      throw new AbortTaskRunError(getSigningTemplateTooLargeMessage());
    }

    const externalId =
      agreement.signingExternalId ||
      buildAgreementSigningExternalId(payload.teamId, agreement.id);

    let templateFolderId: string | null = null;
    try {
      setStatus({ progress: 35, text: "Preparing signing folder..." });
      ({ templateFolderId } = await ensureTeamSigningFolders(payload.teamId));
    } catch (folderError) {
      logger.warn("Failed to ensure team signing folders during setup", {
        error: folderError instanceof Error ? folderError.message : folderError,
        teamId: payload.teamId,
      });
    }

    setStatus({ progress: 55, text: "Creating signing template..." });

    const template = await createSigningTemplateEnvelope({
      title: agreement.name,
      externalId,
      folderId: templateFolderId,
      file: {
        fileName: payload.file.fileName,
        content: new Uint8Array(pdfBuffer),
      },
    });

    setStatus({ progress: 85, text: "Saving signing template..." });

    const updatedAgreement = await prisma.agreement.update({
      where: {
        id: agreement.id,
      },
      data: {
        signingExternalId: externalId,
        signingEnvelopeId: template.envelopeId,
        signingTemplateId: String(template.id),
      },
      select: {
        signingEnvelopeId: true,
        signingTemplateId: true,
        signingExternalId: true,
      },
    });

    setStatus({ progress: 100, text: "Signing template ready." });

    return {
      externalId: updatedAgreement.signingExternalId,
      envelopeId: updatedAgreement.signingEnvelopeId,
      templateId: updatedAgreement.signingTemplateId,
    };
  },
});
