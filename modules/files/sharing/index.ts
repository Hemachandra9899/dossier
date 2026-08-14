import prisma from "@/platform/db";

export interface CreateFileShareInput {
  fileId: string;
  name?: string;
  expiresAt?: Date;
  passcode?: string;
}

/**
 * Dossier facade for managing file sharing & public access (hides Papermark Dataroom / Link model).
 */
export async function createFileShare(input: CreateFileShareInput) {
  const file = await prisma.dossierFile.findUnique({
    where: { id: input.fileId },
    select: { dataroomId: true, teamId: true },
  });

  if (!file || !file.dataroomId) {
    throw new Error("Dataroom link target not found for file.");
  }

  return prisma.link.create({
    data: {
      teamId: file.teamId,
      dataroomId: file.dataroomId,
      name: input.name || "Share Link",
      type: "DATAROOM_LINK",
      expiresAt: input.expiresAt || null,
      password: input.passcode || null,
    },
  });
}

export async function getPublicFileAccess(linkId: string) {
  return prisma.link.findUnique({
    where: { id: linkId },
    include: {
      dataroom: true,
    },
  });
}
