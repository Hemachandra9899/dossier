import prisma from "@/platform/db";
import { cuid } from "@/shared/utils/utils";
import { buildRequestExternalId } from "../domain/external-id";
import { SigningNotFoundError } from "../domain/signing-errors";

export class SignatureRequestRepository {
  async createWithRecipients(input: {
    teamId: string;
    documentId: string;
    templateId: string;
    linkId?: string;
    dossierFileId?: string;
    expiresAt?: Date;
    recipients: Array<{
      name?: string;
      email?: string;
      phone?: string;
      signingOrder?: number;
    }>;
  }) {
    const id = cuid();
    const providerExternalId = buildRequestExternalId({
      teamId: input.teamId,
      requestId: id,
    });

    const request = await prisma.signatureRequest.create({
      data: {
        id,
        teamId: input.teamId,
        documentId: input.documentId,
        templateId: input.templateId,
        linkId: input.linkId,
        dossierFileId: input.dossierFileId,
        providerExternalId,
        expiresAt: input.expiresAt,
        status: "PREPARING",
        recipients: {
          create: input.recipients.map((r, i) => ({
            name: r.name,
            email: r.email,
            phone: r.phone,
            signingOrder: r.signingOrder ?? i + 1,
            status: "PENDING",
          })),
        },
      },
      include: {
        recipients: true,
        document: true,
        template: true,
      },
    });

    return request;
  }

  async findActiveByTeamAndDocument(teamId: string, documentId: string) {
    return prisma.signatureRequest.findFirst({
      where: {
        teamId,
        documentId,
        status: {
          in: ["DRAFT", "PREPARING", "READY", "SENT", "VIEWED", "SIGNING", "PARTIALLY_SIGNED"],
        },
      },
      include: {
        recipients: { orderBy: { signingOrder: "asc" } },
        document: true,
        template: true,
        artifact: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findLatestByTeamAndDocument(teamId: string, documentId: string) {
    return prisma.signatureRequest.findFirst({
      where: {
        teamId,
        documentId,
      },
      include: {
        recipients: { orderBy: { signingOrder: "asc" } },
        document: true,
        template: true,
        artifact: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByTeamAndIdWithRecipients(teamId: string, id: string) {
    const request = await prisma.signatureRequest.findFirst({
      where: { id, teamId },
      include: {
        recipients: { orderBy: { signingOrder: "asc" } },
        document: true,
        template: true,
        artifact: true,
      },
    });

    if (!request) {
      throw new SigningNotFoundError(`Signature request ${id} not found`);
    }

    return request;
  }

  async findByIdWithRecipients(id: string) {
    const request = await prisma.signatureRequest.findUnique({
      where: { id },
      include: {
        recipients: { orderBy: { signingOrder: "asc" } },
        document: true,
        template: true,
        artifact: true,
      },
    });

    if (!request) {
      throw new SigningNotFoundError(`Signature request ${id} not found`);
    }

    return request;
  }

  async findByIdForRecipient(id: string) {
    return this.findByIdWithRecipients(id);
  }

  async findById(id: string) {
    const request = await prisma.signatureRequest.findUnique({
      where: { id },
      include: {
        recipients: true,
        document: true,
        template: true,
        artifact: true,
      },
    });

    if (!request) {
      throw new SigningNotFoundError(`Signature request ${id} not found`);
    }

    return request;
  }

  async updateStatus(id: string, status: any, extra: any = {}) {
    return prisma.signatureRequest.update({
      where: { id },
      data: {
        status,
        ...extra,
      },
      include: {
        recipients: true,
      },
    });
  }

  async updateProviderIds(id: string, data: { providerEnvelopeId?: string; providerDocumentId?: number }) {
    return prisma.signatureRequest.update({
      where: { id },
      data,
    });
  }

  async updateRecipientProviderIds(
    recipientId: string,
    data: { providerRecipientId?: string; providerDocumentId?: number },
  ) {
    return prisma.signatureRecipient.update({
      where: { id: recipientId },
      data: {
        providerRecipientId: data.providerRecipientId,
        providerDocumentId: data.providerDocumentId,
      },
    });
  }

  async updateRecipientStatus(recipientId: string, status: any, extra: any = {}) {
    return prisma.signatureRecipient.update({
      where: { id: recipientId },
      data: {
        status,
        ...extra,
      },
    });
  }

  async createActivity(data: {
    signatureRequestId: string;
    recipientId?: string;
    type: any;
    metadata?: any;
  }) {
    return prisma.signatureActivity.create({
      data: {
        signatureRequestId: data.signatureRequestId,
        recipientId: data.recipientId,
        type: data.type,
        metadata: data.metadata,
      },
    });
  }

  async createDelivery(data: {
    signatureRequestId: string;
    recipientId?: string;
    type: any;
    status?: any;
    failedReason?: string;
  }) {
    return prisma.signatureDelivery.create({
      data: {
        signatureRequestId: data.signatureRequestId,
        recipientId: data.recipientId,
        type: data.type,
        status: data.status || "PENDING",
        failedReason: data.failedReason,
      },
    });
  }

  async findArtifactByRequestId(requestId: string) {
    return prisma.signatureArtifact.findUnique({
      where: { signatureRequestId: requestId },
    });
  }

  async createArtifact(data: {
    signatureRequestId: string;
    storageKey: string;
    fileName: string;
    mimeType?: string;
    sha256: string;
    sizeBytes: bigint;
  }) {
    return prisma.signatureArtifact.create({
      data: {
        signatureRequestId: data.signatureRequestId,
        storageKey: data.storageKey,
        fileName: data.fileName,
        mimeType: data.mimeType || "application/pdf",
        sha256: data.sha256,
        sizeBytes: data.sizeBytes,
      },
    });
  }
}
