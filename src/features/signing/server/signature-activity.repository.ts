import { Prisma } from "@prisma/client";
import prisma from "@/platform/db";

import type { SignatureActivityType } from "@prisma/client";

// Activity-timeline persistence. Every state transition a user can see in the
// request activity feed lands here; the repository is deliberately tiny so the
// timeline history is append-only and easy to audit.
export class SignatureActivityRepository {
  async create(data: {
    signatureRequestId: string;
    recipientId?: string;
    type: SignatureActivityType;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.signatureActivity.create({
      data: {
        signatureRequestId: data.signatureRequestId,
        recipientId: data.recipientId,
        type: data.type,
        metadata: data.metadata ?? undefined,
      },
    });
  }
}