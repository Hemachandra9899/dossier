import { prisma } from "@/platform/db";

export async function getDossierFileTemplates(teamId: string) {
  return prisma.dossierFileTemplate.findMany({
    where: {
      OR: [
        { teamId },
        { isGlobal: true },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isGlobal: true,
      version: true,
      requirements: {
        select: {
          id: true,
          title: true,
          type: true,
          description: true,
          expectedKind: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
export const getTemplates = getDossierFileTemplates;
