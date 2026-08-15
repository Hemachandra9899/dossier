import { requirementRepository } from "./requirement.repository";
import type { AddRequirementInput, UpdateRequirementInput } from "./requirement.types";

export const requirementService = {
  addRequirement: requirementRepository.addRequirement,
  updateRequirement: requirementRepository.updateRequirement,
  async requestCorrection(taskId: string, comment: string) {
    return requirementRepository.updateRequirement(taskId, {
      status: "OPEN",
      comment,
    });
  },
};
