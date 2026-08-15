import prisma from "@/platform/db";

export class ProviderEventRepository {
  async findDuplicate(dedupeKey: string) {
    return prisma.signingProviderEvent.findUnique({
      where: { dedupeKey },
    });
  }

  // Idempotent insert: on conflict (dedupeKey) do nothing, return existing.
  async insertIfAbsent(data: {
    dedupeKey: string;
    eventType: string;
    payload: any;
    provider?: any;
    externalId?: string;
    providerDocumentId?: number;
  }) {
    const existing = await prisma.signingProviderEvent.findUnique({
      where: { dedupeKey: data.dedupeKey },
    });
    if (existing) {
      return { created: false, id: existing.id };
    }
    const created = await prisma.signingProviderEvent.create({
      data: {
        provider: data.provider || "DOCUMENSO",
        dedupeKey: data.dedupeKey,
        eventType: data.eventType,
        payload: data.payload,
        externalId: data.externalId,
        providerDocumentId: data.providerDocumentId,
      },
    });
    return { created: true, id: created.id };
  }

  async recordEvent(data: {
    dedupeKey: string;
    eventType: string;
    payload: any;
    provider?: any;
    externalId?: string;
    providerDocumentId?: number;
  }) {
    return prisma.signingProviderEvent.create({
      data: {
        provider: data.provider || "DOCUMENSO",
        dedupeKey: data.dedupeKey,
        eventType: data.eventType,
        payload: data.payload,
        externalId: data.externalId,
        providerDocumentId: data.providerDocumentId,
      },
    });
  }

  async findById(id: string) {
    return prisma.signingProviderEvent.findUnique({
      where: { id },
    });
  }

  async markProcessed(id: string) {
    return prisma.signingProviderEvent.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }

  async markFailed(id: string, errorCode?: string) {
    return prisma.signingProviderEvent.update({
      where: { id },
      data: {
        failedAt: new Date(),
        errorCode,
      },
    });
  }
}
