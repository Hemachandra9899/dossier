import prisma from "@/platform/db";

import type { SignatureDeliveryStatus, SignatureDeliveryType } from "@prisma/client";

// Delivery persistence: every email/notification attempt for a request or a
// single recipient. `status` transitions PENDING -> SENT/FAILED and is bumped
// by the delivery pipeline (send/remind/auto-delivery).
export class SignatureDeliveryRepository {
  async create(data: {
    signatureRequestId: string;
    recipientId?: string;
    type: SignatureDeliveryType;
    status?: SignatureDeliveryStatus;
    failedReason?: string;
  }) {
    return prisma.signatureDelivery.create({
      data: {
        signatureRequestId: data.signatureRequestId,
        recipientId: data.recipientId,
        type: data.type,
        status: data.status ?? "PENDING",
        failedReason: data.failedReason,
      },
    });
  }

  async updateStatus(
    deliveryId: string,
    data: {
      status?: SignatureDeliveryStatus;
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
}