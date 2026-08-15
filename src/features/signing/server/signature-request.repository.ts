import { Prisma } from "@prisma/client";
import prisma from "@/platform/db";
import { cuid } from "@/shared/utils/utils";
import { buildRequestExternalId } from "../domain/external-id";
import { SigningNotFoundError } from "../domain/signing-errors";

// Every place that loads a request for a DTO or a use-case needs the full
// relation set. `document`/`template`/`artifact` back the request itself;
// `deliveries`/`activities` feed the activity timeline and DTO mapping.
const REQUEST_DETAIL_INCLUDE = {
  recipients: { orderBy: { signingOrder: "asc" } },
  document: true,
  template: true,
  artifact: true,
  deliveries: { orderBy: { createdAt: "asc" } },
  activities: { orderBy: { timestamp: "asc" } },
} satisfies Prisma.SignatureRequestInclude;

export type SignatureRequestWithRecipients = Awaited<
  ReturnType<SignatureRequestRepository["findByIdWithRecipients"]>
>;

export class SignatureRequestRepository {
  async createWithRecipients(input: {
    teamId: string;
    documentId: string;
    templateId: string;
    linkId?: string;
    dossierFileId?: string | null;
    expiresAt?: Date | null;
    status?: "DRAFT" | "PREPARING";
    recipients: Array<{
      name?: string | null;
      email?: string | null;
      phone?: string | null;
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
        status: input.status ?? "PREPARING",
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
      include: REQUEST_DETAIL_INCLUDE,
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
      include: REQUEST_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async findLatestByTeamAndDocument(teamId: string, documentId: string) {
    return prisma.signatureRequest.findFirst({
      where: {
        teamId,
        documentId,
      },
      include: REQUEST_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async findByTeamAndIdWithRecipients(teamId: string, id: string) {
    const request = await prisma.signatureRequest.findFirst({
      where: { id, teamId },
      include: REQUEST_DETAIL_INCLUDE,
    });

    if (!request) {
      throw new SigningNotFoundError(`Signature request ${id} not found`);
    }

    return request;
  }

  async findByIdWithRecipients(id: string) {
    const request = await prisma.signatureRequest.findUnique({
      where: { id },
      include: REQUEST_DETAIL_INCLUDE,
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
      include: REQUEST_DETAIL_INCLUDE,
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
      include: REQUEST_DETAIL_INCLUDE,
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
    data: { providerRecipientId?: string | number; providerDocumentId?: number },
  ) {
    return prisma.signatureRecipient.update({
      where: { id: recipientId },
      data: {
        providerRecipientId:
          data.providerRecipientId != null
            ? String(data.providerRecipientId)
            : undefined,
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

  async updateDeliveryStatus(
    deliveryId: string,
    data: {
      status?: any;
      failedReason?: string;
      lastAttemptAt?: Date;
    },
  ) {
    return prisma.signatureDelivery.update({
      where: { id: deliveryId },
      data: {
        status: data.status,
        failedReason: data.failedReason,
        lastAttemptAt: data.lastAttemptAt,
      },
    });
  }

  async findTeamName(teamId: string) {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
  }

  async findDocumentName(documentId: string) {
    return prisma.document.findUnique({
      where: { id: documentId },
      select: { name: true },
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
