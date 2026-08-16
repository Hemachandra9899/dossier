import prisma from "@/platform/db";
import { v4 as uuidv4 } from "uuid";

export async function createFile(input: any) {
  const teamId = typeof input === "string" ? input : input.teamId;
  const name = typeof input === "string" ? "New File" : input.name || "New File";
  const clientName = typeof input === "object" ? input.clientName : undefined;

  const pId = `dr_${uuidv4().substring(0, 8)}`;

  const dataroom = await prisma.dataroom.create({
    data: {
      teamId,
      name,
      pId,
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
