import { evaluateVerificationChecks } from "./verification.rules";
import { extractDocumentFacts } from "./providers/openai.provider";

export const verificationService = {
  evaluateVerificationChecks,
  extractDocumentFacts,
};
