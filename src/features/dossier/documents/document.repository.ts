import prisma from "@/infrastructure/database/prisma";

export const documentRepository = {
  async findById(documentId: string) {
    return prisma.document.findUnique({
      where: { id: documentId },
    });
  },

  async deleteById(documentId: string) {
    return prisma.document.delete({
      where: { id: documentId },
    });
  },
};
