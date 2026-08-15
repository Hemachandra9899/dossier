import prisma from "@/platform/db";

export async function getFilesBoard(input: any) {
  const teamId = typeof input === "string" ? input : input.teamId;
  return prisma.dossierFile.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
  });
}
