import prisma from "@/src/infrastructure/database/prisma";
import type { AddRequirementInput, UpdateRequirementInput } from "./requirement.types";

export const requirementRepository = {
  async addRequirement(input: AddRequirementInput) {
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
  },

  async updateRequirement(taskId: string, input: UpdateRequirementInput) {
    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      },
    });
  },
};
