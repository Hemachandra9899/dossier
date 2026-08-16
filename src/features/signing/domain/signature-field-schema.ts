// Field input validation shared by the fields API and the save-fields use-case.

import { z } from "zod";

import { SIGNATURE_FIELD_TYPES } from "../domain/signature-field";

const signatureFieldTypes = SIGNATURE_FIELD_TYPES.map(({ type }) => type) as [
  string,
  ...string[],
];

export const signatureFieldInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    recipientId: z.string().min(1),
    type: z.enum(signatureFieldTypes as never),
    pageNumber: z.number().int().min(1),
    // normalized 0..1 coordinates
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive(),
    height: z.number().positive(),
    required: z.boolean().optional(),
    label: z.string().max(255).nullish(),
    placeholder: z.string().max(255).nullish(),
    options: z.array(z.string()).nullish(),
  })
  .strict();

export const signatureFieldsInputSchema = z
  .object({
    fields: z.array(signatureFieldInputSchema).max(500),
  })
  .strict();
