// Prisma-backed provider-event inbox. Deliveries are inserted idempotently on
// `dedupeKey`; duplicates are reported but never persisted twice. Used by the
// webhook pipeline (next checkpoint) and exercised directly by tests.

import type { Prisma, PrismaClient } from "@prisma/client";

import type { SignatureProviderName } from "../domain/signing-event";

export interface ProviderEventInboxInput {
  provider: SignatureProviderName;
  dedupeKey: string;
  eventType: string;
  externalId?: string | null;
  providerDocumentId?: number | null;
  payload: unknown;
}

export class ProviderEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Inserts the event unless a delivery with the same dedupeKey already
   * exists. Safe to call for every webhook hit; returns `created: false` for
   * duplicates instead of erroring.
   */
  async insertIfAbsent(
    input: ProviderEventInboxInput,
  ): Promise<{ created: boolean; id: string }> {
    const existing = await this.prisma.signingProviderEvent.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: { id: true },
    });
    if (existing) return { created: false, id: existing.id };

    try {
      const created = await this.prisma.signingProviderEvent.create({
        data: {
          provider: input.provider,
          dedupeKey: input.dedupeKey,
          eventType: input.eventType,
          externalId: input.externalId ?? null,
          providerDocumentId: input.providerDocumentId ?? null,
          payload: input.payload as Prisma.JsonObject,
        },
      });
      return { created: true, id: created.id };
    } catch (error) {
      // Unique constraint raced us: another delivery persisted the same key.
      if (isUniqueConstraintViolation(error)) {
        const existing = await this.prisma.signingProviderEvent.findUniqueOrThrow({
          where: { dedupeKey: input.dedupeKey },
          select: { id: true },
        });
        return { created: false, id: existing.id };
      }
      throw error;
    }
  }

  async findByDedupeKey(dedupeKey: string) {
    return this.prisma.signingProviderEvent.findUnique({
      where: { dedupeKey },
    });
  }

  async findById(id: string) {
    return this.prisma.signingProviderEvent.findUnique({
      where: { id },
    });
  }

  async markProcessed(id: string, processedAt = new Date()) {
    return this.prisma.signingProviderEvent.update({
      where: { id },
      data: { processedAt, failedAt: null, errorCode: null },
    });
  }

  async markFailed(id: string, errorCode: string) {
    return this.prisma.signingProviderEvent.update({
      where: { id },
      data: { failedAt: new Date(), errorCode },
    });
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
