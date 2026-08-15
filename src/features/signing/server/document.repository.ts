import prisma from "@/platform/db";
import {
  SigningNotFoundError,
  SigningValidationError,
} from "../domain/signing-errors";

export class DocumentRepository {
  async findForTemplateUpload(teamId: string, documentId: string) {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        teamId,
      },
      include: {
        versions: {
          where: { isPrimary: true },
        },
      },
    });

    if (!document) {
      throw new SigningNotFoundError(`Document ${documentId} not found`);
    }

    const version = document.versions[0] || (await prisma.documentVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { versionNumber: "desc" },
    }));

    if (!version) {
      throw new SigningValidationError("Document has no available versions to sign");
    }

    return {
      id: document.id,
      name: document.name,
      teamId: document.teamId,
      file: version.file,
      storageType: version.storageType,
    };
  }

  async findSignableByTeamAndId(teamId: string, documentId: string) {
    return this.findForTemplateUpload(teamId, documentId);
  }

  async findById(id: string) {
    return prisma.document.findUnique({
      where: { id },
      include: {
        versions: true,
      },
    });
  }
}
