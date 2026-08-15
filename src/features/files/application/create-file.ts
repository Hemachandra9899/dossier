import prisma from "@/platform/db";

export async function createFile(input: any) {
  const teamId = typeof input === "string" ? input : input.teamId;
  const name = typeof input === "string" ? "New File" : input.name || "New File";
  const clientName = typeof input === "object" ? input.clientName : undefined;

  const dataroom = await prisma.dataroom.create({
    data: {
      teamId,
      name,
    } as any,
  });

  const taskList = await prisma.taskList.create({
    data: {
      dataroomId: dataroom.id,
      teamId,
      name: "Requirements",
    },
  });

  return prisma.dossierFile.create({
    data: {
      teamId,
      dataroomId: dataroom.id,
      requirementsTaskListId: taskList.id,
      clientName: clientName || null,
      status: "NEW",
    } as any,
  });
}

export const createDossierFile = createFile;
