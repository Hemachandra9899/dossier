import prisma from "@/platform/db";
import { cuid } from "@/shared/utils/utils";
import { buildTemplateExternalId } from "../domain/external-id";
import { SigningNotFoundError } from "../domain/signing-errors";

export class SignatureTemplateRepository {
  async createWithExternalId(input: {
    teamId: string;
    documentId: string;
    name: string;
  }) {
    const id = cuid();
    const providerExternalId = buildTemplateExternalId({
      teamId: input.teamId,
      templateId: id,
    });

    const template = await prisma.signatureTemplate.create({
      data: {
        id,
        teamId: input.teamId,
        documentId: input.documentId,
        name: input.name,
        providerExternalId,
        status: "PREPARING",
      },
    });

    return template;
  }

  async update(id: string, data: any) {
    return prisma.signatureTemplate.update({
      where: { id },
      data,
    });
  }

  async findByTeamAndId(teamId: string, id: string) {
    const template = await prisma.signatureTemplate.findFirst({
      where: { id, teamId },
      include: {
        document: true,
      },
    });

    if (!template) {
      throw new SigningNotFoundError(`Signature template ${id} not found`);
    }

    return template;
  }

  async findById(id: string) {
    const template = await prisma.signatureTemplate.findUnique({
      where: { id },
      include: {
        document: true,
      },
    });

    if (!template) {
      throw new SigningNotFoundError(`Signature template ${id} not found`);
    }

    return template;
  }
}
