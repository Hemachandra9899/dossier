// Prisma-backed SignatureRequest persistence, including recipients and the
// immutable signed artifact.

import type {
  PrismaClient,
  SignatureRecipient,
  SignatureRecipientStatus,
  SignatureRequest,
  SignatureRequestStatus,
  SignatureDelivery,
  SignatureDeliveryStatus,
  SignatureDeliveryType,
  SignatureActivity,
  SignatureActivityType,
} from "@prisma/client";

import { buildRequestExternalId } from "../domain/external-id";
import { SIGNATURE_REQUEST_TERMINAL_STATUSES } from "../domain/signature-request";
import type { NormalizedRecipient } from "../domain/recipient-validation";

export type SignatureRequestWithRecipients = SignatureRequest & {
  recipients: SignatureRecipient[];
  deliveries: SignatureDelivery[];
  activities: SignatureActivity[];
};

export const signatureRequestInclude = {
  recipients: { orderBy: { signingOrder: "asc" as const } },
  deliveries: { orderBy: { createdAt: "desc" as const } },
  activities: { orderBy: { timestamp: "desc" as const } },
} as const;

export interface CreateRequestWithRecipientsInput {
  teamId: string;
  documentId: string;
  templateId: string;
  linkId?: string | null;
  expiresAt?: Date | null;
  recipients: NormalizedRecipient[];
}

export class SignatureRequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Atomically creates a signature request in PREPARING together with its
   * recipients and stamps the deterministic Dossier external id — all inside
   * one transaction so no ambiguous intermediate state is ever visible. The
   * application layer drives the provider call and then moves the request to
   * READY or FAILED.
   */
  async createWithRecipients(
    input: CreateRequestWithRecipientsInput,
  ): Promise<SignatureRequestWithRecipients> {
    return this.prisma.$transaction(async (tx) => {
      const temporaryExternalId = `dossier:temporary:${crypto.randomUUID()}`;
      const created = await tx.signatureRequest.create({
        data: {
          teamId: input.teamId,
          documentId: input.documentId,
          templateId: input.templateId,
          linkId: input.linkId ?? null,
          expiresAt: input.expiresAt ?? null,
          providerExternalId: temporaryExternalId,
          status: "PREPARING",
        },
      });

      const externalId = buildRequestExternalId({
        teamId: input.teamId,
        requestId: created.id,
      });

      await tx.signatureRequest.update({
        where: { id: created.id },
        data: { providerExternalId: externalId },
      });

      await tx.signatureRecipient.createMany({
        data: input.recipients.map((recipient) => ({
          signatureRequestId: created.id,
          name: recipient.name,
          email: recipient.email,
          phone: recipient.phone,
          signingOrder: recipient.signingOrder,
        })),
      });

      return tx.signatureRequest.findUniqueOrThrow({
        where: { id: created.id },
        include: signatureRequestInclude,
      });
    });
  }

  async updateStatus(
    id: string,
    status: SignatureRequestStatus,
    extra: {
      sentAt?: Date;
      viewedAt?: Date;
      completedAt?: Date;
      cancelledAt?: Date;
    } = {},
  ): Promise<SignatureRequestWithRecipients> {
    return this.prisma.signatureRequest.update({
      where: { id },
      data: { status, ...extra },
      include: signatureRequestInclude,
    });
  }

  async updateProviderIds(
    id: string,
    providerIds: {
      providerEnvelopeId: string;
      providerDocumentId: number;
    },
  ): Promise<SignatureRequest> {
    return this.prisma.signatureRequest.update({
      where: { id },
      data: providerIds,
    });
  }

  async updateRecipientProviderIds(
    recipientId: string,
    providerIds: {
      providerRecipientId: number;
      providerDocumentId: number;
    },
  ): Promise<SignatureRecipient> {
    return this.prisma.signatureRecipient.update({
      where: { id: recipientId },
      data: {
        providerRecipientId: String(providerIds.providerRecipientId),
        providerDocumentId: providerIds.providerDocumentId,
      },
    });
  }

  async updateRecipientStatus(
    recipientId: string,
    status: SignatureRecipientStatus,
    extra: { viewedAt?: Date; signedAt?: Date } = {},
  ): Promise<SignatureRecipient> {
    return this.prisma.signatureRecipient.update({
      where: { id: recipientId },
      data: { status, ...extra },
    });
  }

  async findByTeamAndId(
    teamId: string,
    requestId: string,
  ): Promise<SignatureRequest | null> {
    return this.prisma.signatureRequest.findFirst({
      where: { id: requestId, teamId },
    });
  }

  async findByTeamAndIdWithRecipients(
    teamId: string,
    requestId: string,
  ): Promise<SignatureRequestWithRecipients | null> {
    return this.prisma.signatureRequest.findFirst({
      where: { id: requestId, teamId },
      include: signatureRequestInclude,
    });
  }

  /** Recipient-facing lookup: scoped by requestId only (no team knowledge). */
  async findById(requestId: string): Promise<SignatureRequest | null> {
    return this.prisma.signatureRequest.findUnique({ where: { id: requestId } });
  }

  async findByIdWithRecipients(
    requestId: string,
  ): Promise<SignatureRequestWithRecipients | null> {
    return this.prisma.signatureRequest.findUnique({
      where: { id: requestId },
      include: signatureRequestInclude,
    });
  }

  /**
   * Recipient/public lookup: the request plus the minimal document fields the
   * public signing page needs. Never exposes recipient or team data.
   */
  async findByIdWithDocument(requestId: string) {
    return this.prisma.signatureRequest.findUnique({
      where: { id: requestId },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            contentType: true,
            file: true,
            storageType: true,
          },
        },
      },
    });
  }

  /**
   * Recipient/public lookup used by the access-proofed info endpoint. Selects
   * only the fields a verified recipient may see — document name, recipient
   * name and lifecycle timestamps — never provider or team data.
   */
  async findByIdForRecipient(requestId: string) {
    return this.prisma.signatureRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        completedAt: true,
        document: { select: { name: true } },
        recipients: { select: { id: true, name: true, status: true, email: true } },
      },
    });
  }

  /** Latest non-terminal request for a document (drives the "active request"
   *  summary in the sender UI). */
  async findActiveByTeamAndDocument(teamId: string, documentId: string) {
    return this.prisma.signatureRequest.findFirst({
      where: {
        teamId,
        documentId,
        status: { notIn: [...SIGNATURE_REQUEST_TERMINAL_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
      include: signatureRequestInclude,
    });
  }

  async findLatestByTeamAndDocument(teamId: string, documentId: string) {
    return this.prisma.signatureRequest.findFirst({
      where: { teamId, documentId },
      orderBy: { createdAt: "desc" },
      include: signatureRequestInclude,
    });
  }

  async findByProviderExternalId(
    externalId: string,
  ): Promise<SignatureRequestWithRecipients | null> {
    return this.prisma.signatureRequest.findUnique({
      where: { providerExternalId: externalId },
      include: signatureRequestInclude,
    });
  }

  /** Mirror-only lookup: needs the team + document name for storage + naming. */
  async findByIdForMirror(requestId: string) {
    return this.prisma.signatureRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        teamId: true,
        status: true,
        providerEnvelopeId: true,
        providerDocumentId: true,
        document: { select: { name: true } },
      },
    });
  }

  async findArtifactByRequestId(requestId: string) {
    return this.prisma.signatureArtifact.findUnique({
      where: { signatureRequestId: requestId },
    });
  }

  /**
   * Creates the immutable SignatureArtifact row. Throws the underlying unique
   * constraint error on collision — callers must treat artifacts as write-once.
   */
  async createArtifact(input: {
    signatureRequestId: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    sizeBytes: bigint;
  }) {
    return this.prisma.signatureArtifact.create({ data: input });
  }

  async createActivity(input: {
    signatureRequestId: string;
    recipientId?: string | null;
    type: SignatureActivityType;
    metadata?: any;
  }): Promise<SignatureActivity> {
    return this.prisma.signatureActivity.create({
      data: {
        signatureRequestId: input.signatureRequestId,
        recipientId: input.recipientId ?? null,
        type: input.type,
        metadata: input.metadata ?? undefined,
      },
    });
  }

  async createDelivery(input: {
    signatureRequestId: string;
    recipientId?: string | null;
    type: SignatureDeliveryType;
    status: SignatureDeliveryStatus;
    failedReason?: string | null;
  }): Promise<SignatureDelivery> {
    return this.prisma.signatureDelivery.create({
      data: {
        signatureRequestId: input.signatureRequestId,
        recipientId: input.recipientId ?? null,
        type: input.type,
        status: input.status,
        failedReason: input.failedReason ?? null,
      },
    });
  }
}
