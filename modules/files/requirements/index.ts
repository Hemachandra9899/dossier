import prisma from "@/platform/db";

export interface AddRequirementInput {
  fileId: string;
  title: string;
  type: "TODO" | "UPLOAD" | "ACKNOWLEDGE";
  description?: string;
  assigneeEmail?: string;
}

export interface UpdateRequirementInput {
  status?: "OPEN" | "SUBMITTED" | "COMPLETED" | "REJECTED";
  comment?: string;
}

/**
 * Dossier facade for managing file requirements (hides Papermark Task / TaskList model).
 */
export async function addRequirement(input: AddRequirementInput) {
  const file = await prisma.dossierFile.findUnique({
    where: { id: input.fileId },
    select: { requirementsTaskListId: true, dataroomId: true, teamId: true },
  });

  if (!file || !file.requirementsTaskListId) {
    throw new Error("Requirements task list not found for file.");
  }

  return prisma.task.create({
    data: {
      taskListId: file.requirementsTaskListId,
      dataroomId: file.dataroomId,
      teamId: file.teamId,
      title: input.title,
      type: input.type,
      description: input.description || null,
      status: "OPEN",
    },
  });
}

export async function updateRequirement(taskId: string, input: UpdateRequirementInput) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    },
  });
}

export async function requestCorrection(taskId: string, comment: string) {
  return updateRequirement(taskId, {
    status: "OPEN",
    comment,
  });
}
