import { DocumentStorageType } from "@prisma/client";
import prisma from "@/platform/db";
import { nanoid } from "@/shared/utils/utils";

export interface ProcessDocumentData {
  name: string;
  key: string;
  storageType?: string;
  numPages?: number;
  supportedFileType?: string;
  contentType?: string | null;
  fileSize?: number;
  enableExcelAdvancedMode?: boolean;
}

export interface ProcessDocumentParams {
  documentData: ProcessDocumentData;
  teamId: string;
  userId: string;
  teamPlan?: string;
  createLink?: boolean;
  folderPathName?: string;
}

export async function processDocument({
  documentData,
  teamId,
  userId,
  createLink = false,
  folderPathName,
}: ProcessDocumentParams) {
  let folderId: string | null = null;

  // 1. Resolve folder if folderPathName is provided
  if (folderPathName) {
    const trimmedPath = folderPathName.trim();
    if (trimmedPath) {
      let existingFolder = await prisma.folder.findFirst({
        where: {
          teamId,
          path: trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`,
        },
      });

      if (!existingFolder) {
        const folderName = trimmedPath.split("/").filter(Boolean).pop() || trimmedPath;
        existingFolder = await prisma.folder.create({
          data: {
            name: folderName,
            path: trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`,
            teamId,
          },
        });
      }
      folderId = existingFolder.id;
    }
  }

  // 2. Normalize storageType
  const storageTypeEnum =
    documentData.storageType === "VERCEL_BLOB"
      ? DocumentStorageType.VERCEL_BLOB
      : DocumentStorageType.S3_PATH;

  // 3. Create Document and first DocumentVersion in a transaction
  const document = await prisma.document.create({
    data: {
      name: documentData.name,
      file: documentData.key,
      type: documentData.supportedFileType || "pdf",
      contentType: documentData.contentType || "application/pdf",
      storageType: storageTypeEnum,
      numPages: documentData.numPages || 1,
      teamId,
      ownerId: userId,
      folderId,
      advancedExcelEnabled: documentData.enableExcelAdvancedMode || false,
      versions: {
        create: {
          versionNumber: 1,
          file: documentData.key,
          type: documentData.supportedFileType || "pdf",
          contentType: documentData.contentType || "application/pdf",
          fileSize: documentData.fileSize ? BigInt(documentData.fileSize) : null,
          storageType: storageTypeEnum,
          numPages: documentData.numPages || 1,
          hasPages: true,
          isPrimary: true,
        },
      },
      ...(createLink
        ? {
            links: {
              create: {
                linkId: nanoid(7),
                name: "Default Link",
                type: "DOCUMENT",
              },
            },
          }
        : {}),
    },
    include: {
      versions: true,
      folder: true,
      links: true,
    },
  });

  return document;
}

export default processDocument;
