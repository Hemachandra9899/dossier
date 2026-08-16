import prisma from "@/platform/db";

import type { SignatureRecipientStatus } from "../domain/signature-recipient";

// Recipient-scoped persistence. Request creation creates recipients inside a
// single transaction (see SignatureRequestRepository.createWithRecipients);
// this repository owns everything that mutates or reads a recipient row after
// that initial create.
export class SignatureRecipientRepository {
  async updateProviderIds(
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

  async updateStatus(
    recipientId: string,
    status: SignatureRecipientStatus,
    extra: {
      signedAt?: Date;
      viewedAt?: Date;
    } = {},
  ) {
    return prisma.signatureRecipient.update({
      where: { id: recipientId },
      data: {
        status,
        signedAt: extra.signedAt,
        viewedAt: extra.viewedAt,
      },
    });
  }
}