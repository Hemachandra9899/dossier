import { z } from "zod";

export const SignatureTemplateStatusSchema = z.enum([
  "PREPARING",
  "READY",
  "FAILED",
  "ARCHIVED",
]);

export type SignatureTemplateStatus = z.infer<
  typeof SignatureTemplateStatusSchema
>;
