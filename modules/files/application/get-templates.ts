import prisma from "@/lib/prisma";

export async function getDossierFileTemplates(teamId: string) {
  return prisma.dossierFileTemplate.findMany({
    where: {
      OR: [
        { isGlobal: true },
        { teamId },
      ],
    },
    include: {
      requirements: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
