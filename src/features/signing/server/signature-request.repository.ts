import { Prisma, SignatureProvider } from "@prisma/client";
import prisma from "@/platform/db";
import { cuid } from "@/shared/utils/utils";
import { buildRequestExternalId } from "../domain/external-id";
import { SigningNotFoundError } from "../domain/signing-errors";
import type { SignatureRequestStatus } from "../domain/signature-request";

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

// Request-scoped persistence. Recipient/delivery/activity/artifact mutations
// live in their own repositories (signature-recipient.repository.ts, etc.);
// this class owns the SignatureRequest row itself.
export class SignatureRequestRepository {
  async createWithRecipients(input: {
    teamId: string;
    documentId: string;
    documentVersionId?: string | null;
    sourceSha256?: string | null;
    provider?: SignatureProvider;
    templateId?: string | null;
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
        documentVersionId: input.documentVersionId,
        sourceSha256: input.sourceSha256,
        provider: input.provider ?? "NATIVE",
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

  // Returns null instead of throwing; used by mirror/artifact jobs.
  async findByIdForMirror(id: string) {
    return prisma.signatureRequest.findUnique({
      where: { id },
      include: REQUEST_DETAIL_INCLUDE,
    });
  }

  // Team-scoped find without throwing; used by artifact getter.
  async findByTeamAndId(teamId: string, id: string) {
    return prisma.signatureRequest.findFirst({
      where: { id, teamId },
      include: REQUEST_DETAIL_INCLUDE,
    });
  }

  // Lookup by provider externalId + include recipients for webhook processing.
  async findByProviderExternalIdWithRecipients(externalId: string) {
    return prisma.signatureRequest.findUnique({
      where: { providerExternalId: externalId },
      include: REQUEST_DETAIL_INCLUDE,
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
  ) {
    return prisma.signatureRequest.update({
      where: { id },
      data: {
        status,
        sentAt: extra.sentAt,
        viewedAt: extra.viewedAt,
        completedAt: extra.completedAt,
        cancelledAt: extra.cancelledAt,
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

  async updateSourceHash(id: string, sourceSha256: string) {
    return prisma.signatureRequest.update({
      where: { id },
      data: { sourceSha256 },
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
}