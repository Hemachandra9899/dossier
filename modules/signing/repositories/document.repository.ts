// Prisma-backed document access for the signing application layer. Keeps the
// "is this document signable" rule in one place instead of inline Prisma in
// use-cases or route handlers.

import type { PrismaClient } from "@prisma/client";

import { SigningNotFoundError } from "../domain/signing-errors";

export interface SignableDocument {
  id: string;
  name: string;
  contentType: string | null;
  teamId: string;
}

export interface TemplateUploadDocument extends SignableDocument {
  file: string;
  storageType: string;
}

export class DocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Returns a document that belongs to `teamId` and is in a usable state for
   * signing (has a stored file and a PDF content type). Signing requires a
   * PDF; STORE/SHARE documents of other types are not signable.
   */
  async findSignableByTeamAndId(
    teamId: string,
    documentId: string,
  ): Promise<SignableDocument> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        teamId,
        file: { not: "" },
      },
      select: {
        id: true,
        name: true,
        contentType: true,
        teamId: true,
        file: true,
        storageType: true,
      },
    });

    if (!document || !document.contentType?.startsWith("application/pdf")) {
      throw new SigningNotFoundError("Document was not found.");
    }

    return document;
  }

  /** Same team/PDF gate, but also returns the stored-file reference needed to
   *  upload the document to the signing provider. */
  async findForTemplateUpload(
    teamId: string,
    documentId: string,
  ): Promise<TemplateUploadDocument> {
    const document = (await this.findSignableByTeamAndId(
      teamId,
      documentId,
    )) as TemplateUploadDocument;

    if (!document.file || !document.storageType) {
      throw new SigningNotFoundError("Document was not found.");
    }

    return document;
  }
}
