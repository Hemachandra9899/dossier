import prisma from "@/src/infrastructure/database/prisma";

export const fileRepository = {
  async findById(fileId: string) {
    return prisma.dossierFile.findUnique({
      where: { id: fileId },
      include: {
        dataroom: true,
        requirementsTaskList: true,
      },
    });
  },
};
