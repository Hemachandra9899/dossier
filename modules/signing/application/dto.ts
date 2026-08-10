// DTO mapping helpers shared by the signing application use-cases. Use-cases
// return plain JSON-safe DTOs (never Prisma rows) so route handlers can pass
// them straight to res.json(). Note sizeBytes is a BigInt in Prisma and must
// be converted before it reaches JSON.stringify.

import type { SignatureRequestStatus } from "@prisma/client";
import type { SignatureProviderName } from "../domain/signing-event";
import type { SignatureRequestWithRecipients } from "../repositories/signature-request.repository";

export interface RecipientDTO {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  signingOrder: number;
  status: string;
  viewedAt: Date | null;
  signedAt: Date | null;
}

export interface RequestDTO {
  id: string;
  teamId: string;
  documentId: string;
  templateId: string;
  linkId: string | null;
  provider: SignatureProviderName;
  status: SignatureRequestStatus;
  providerExternalId: string;
  providerEnvelopeId: string | null;
  providerDocumentId: number | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  recipients: RecipientDTO[];
}

export function toRequestDTO(
  request: SignatureRequestWithRecipients,
): RequestDTO {
  return {
    id: request.id,
    teamId: request.teamId,
    documentId: request.documentId,
    templateId: request.templateId,
    linkId: request.linkId,
    provider: request.provider,
    status: request.status,
    providerExternalId: request.providerExternalId,
    providerEnvelopeId: request.providerEnvelopeId,
    providerDocumentId: request.providerDocumentId,
    sentAt: request.sentAt,
    viewedAt: request.viewedAt,
    completedAt: request.completedAt,
    cancelledAt: request.cancelledAt,
    expiresAt: request.expiresAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    recipients: request.recipients.map((recipient) => ({
      id: recipient.id,
      name: recipient.name,
      email: recipient.email,
      phone: recipient.phone,
      signingOrder: recipient.signingOrder,
      status: recipient.status,
      viewedAt: recipient.viewedAt,
      signedAt: recipient.signedAt,
    })),
  };
}

export interface SignedArtifactDTO {
  requestId: string;
  status: "pending" | "completed";
  artifact?: {
    storageKey: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    sizeBytes: string;
  };
}

export function pendingArtifactDTO(requestId: string): SignedArtifactDTO {
  return { requestId, status: "pending" };
}

export function completedArtifactDTO(
  requestId: string,
  artifact: {
    storageKey: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    sizeBytes: bigint;
  },
): SignedArtifactDTO {
  return {
    requestId,
    status: "completed",
    artifact: {
      storageKey: artifact.storageKey,
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
      sha256: artifact.sha256,
      sizeBytes: String(artifact.sizeBytes),
    },
  };
}
