import { getCompletionReadiness } from "@/modules/completion/application/get-completion-readiness";
import { createCompletionRun } from "@/modules/completion/application/create-completion-run";

export const completionService = {
  getCompletionReadiness,
  createCompletionRun,
};
