import prisma from "@/platform/db";

export async function getDocumentById(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId },
  });
}

export async function deleteDocumentById(documentId: string) {
  return prisma.document.delete({
    where: { id: documentId },
  });
}
