// Prisma-backed SignatureTemplate persistence. Rows are created locally in
// PREPARING; the application layer drives the provider call and then moves the
// template to READY (with provider ids) or FAILED.

import type { PrismaClient, SignatureTemplate } from "@prisma/client";

import { buildTemplateExternalId } from "../domain/external-id";

export type SignatureTemplateUpdate = Partial<
  Pick<
    SignatureTemplate,
    | "status"
    | "providerTemplateId"
    | "providerEnvelopeId"
    | "name"
  >
>;

export class SignatureTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Atomically creates a locally-owned template row in PREPARING and stamps it
   * with its deterministic Dossier external id (a temporary id guards the
   * unique constraint inside the transaction).
   */
  async createWithExternalId(input: {
    teamId: string;
    documentId: string;
    name: string;
  }): Promise<SignatureTemplate> {
    return this.prisma.$transaction(async (tx) => {
      const temporaryExternalId = `dossier:temporary:${crypto.randomUUID()}`;
      const created = await tx.signatureTemplate.create({
        data: {
          teamId: input.teamId,
          documentId: input.documentId,
          name: input.name,
          providerExternalId: temporaryExternalId,
          status: "PREPARING",
        },
      });

      const externalId = buildTemplateExternalId({
        teamId: input.teamId,
        templateId: created.id,
      });

      return tx.signatureTemplate.update({
        where: { id: created.id },
        data: { providerExternalId: externalId },
      });
    });
  }

  async update(id: string, data: SignatureTemplateUpdate): Promise<SignatureTemplate> {
    return this.prisma.signatureTemplate.update({ where: { id }, data });
  }

  async findByTeamAndId(
    teamId: string,
    templateId: string,
  ): Promise<SignatureTemplate | null> {
    return this.prisma.signatureTemplate.findFirst({
      where: { id: templateId, teamId },
    });
  }

  async findById(templateId: string): Promise<SignatureTemplate | null> {
    return this.prisma.signatureTemplate.findUnique({ where: { id: templateId } });
  }
}
