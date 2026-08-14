import prisma from "@/src/infrastructure/database/prisma";
import type { CreateFileShareInput } from "./public-access.types";

export const publicAccessRepository = {
  async createFileShare(input: CreateFileShareInput) {
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
        linkType: "DATAROOM_LINK",
        expiresAt: input.expiresAt || null,
        password: input.passcode || null,
      },
    });
  },

  async getPublicFileAccess(linkId: string) {
    return prisma.link.findUnique({
      where: { id: linkId },
      include: {
        dataroom: true,
      },
    });
  },
};
