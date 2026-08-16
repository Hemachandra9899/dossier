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
      versionId: version.id,
    };
  }

  async findSignableByTeamAndId(teamId: string, documentId: string) {
    return this.findForTemplateUpload(teamId, documentId);
  }

  /**
   * Resolves the exact document version to sign: the request's pinned
   * documentVersionId when present, otherwise the primary (or latest) version.
   * Native signing ALWAYS pins the version at draft creation; this fallback
   * only covers legacy requests created before version pinning existed.
   */
  async findVersionForRequest(teamId: string, documentId: string, pinnedVersionId?: string | null) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, teamId },
      select: { id: true, name: true, teamId: true },
    });

    if (!document) {
      throw new SigningNotFoundError(`Document ${documentId} not found`);
    }

    let version = pinnedVersionId
      ? await prisma.documentVersion.findUnique({ where: { id: pinnedVersionId } })
      : null;

    if (!version) {
      version =
        (await prisma.documentVersion.findFirst({
          where: { documentId: document.id, isPrimary: true },
        })) ||
        (await prisma.documentVersion.findFirst({
          where: { documentId: document.id },
          orderBy: { versionNumber: "desc" },
        }));
    }

    if (!version) {
      throw new SigningValidationError("Document has no available versions to sign");
    }

    return {
      document: {
        id: document.id,
        name: document.name,
        teamId: document.teamId,
      },
      version: {
        id: version.id,
        file: version.file,
        storageType: version.storageType,
      },
    };
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
