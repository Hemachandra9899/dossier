import { getCompletionReadiness } from "@/features/completion/application/get-completion-readiness";
import { createCompletionRun } from "@/features/completion/application/create-completion-run";

export const completionService = {
  getCompletionReadiness,
  createCompletionRun,
};
