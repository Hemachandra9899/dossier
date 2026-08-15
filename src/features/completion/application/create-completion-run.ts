import prisma from "@/platform/db";

export async function createCompletionRun(input: {
  dossierFileId?: string;
  fileId?: string;
  actorUserId?: string;
  initiatedById?: string;
}) {
  const targetId = input.dossierFileId || input.fileId;
  if (!targetId) throw new Error("File ID required");

  const file = await prisma.dossierFile.findUnique({
    where: { id: targetId },
  });
  if (!file) throw new Error("File not found");

  return prisma.dossierFile.update({
    where: { id: targetId },
    data: { status: "COMPLETE" },
  });
}
