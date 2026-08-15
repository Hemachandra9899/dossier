import prisma from "@/platform/db";

export class ProviderEventRepository {
  async findDuplicate(dedupeKey: string) {
    return prisma.signingProviderEvent.findUnique({
      where: { dedupeKey },
    });
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
