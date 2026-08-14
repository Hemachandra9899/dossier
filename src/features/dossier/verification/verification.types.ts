import { z } from "zod";

export const DOCUMENT_KINDS = [
  "GOVERNMENT_ID",
  "BANK_STATEMENT",
  "PAY_STUB",
  "EMPLOYMENT_LETTER",
  "TAX_DOCUMENT",
  "OTHER",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/**
 * Unified schema for OpenAI structured completions.
 * This instructs the model on all possible fields we want to extract
 * depending on the detected document kind.
 */
export const DocumentExtractionSchema = z.object({
  detectedKind: z.enum(DOCUMENT_KINDS),
  confidenceScore: z.number().min(0).max(1),
  fullName: z.string().nullable().describe("Extracted full name of the document owner/client"),
  address: z.string().nullable().describe("Extracted residential address"),
  dateOfBirth: z.string().nullable().describe("Date of birth (ISO format YYYY-MM-DD if possible)"),
  documentNumber: z.string().nullable().describe("ID number, passport number, account number, etc."),
  issueDate: z.string().nullable().describe("Issue date (ISO format YYYY-MM-DD if possible)"),
  expiryDate: z.string().nullable().describe("Expiration date (ISO format YYYY-MM-DD if possible)"),
  accountHolder: z.string().nullable().describe("Name of the bank account holder"),
  statementStart: z.string().nullable().describe("Statement start date (ISO format YYYY-MM-DD if possible)"),
  statementEnd: z.string().nullable().describe("Statement end date (ISO format YYYY-MM-DD if possible)"),
  employer: z.string().nullable().describe("Employer name on pay stub or employment letter"),
  payPeriodStart: z.string().nullable().describe("Pay period start date (ISO format YYYY-MM-DD if possible)"),
  payPeriodEnd: z.string().nullable().describe("Pay period end date (ISO format YYYY-MM-DD if possible)"),
  taxYear: z.string().nullable().describe("Tax year for tax returns or tax documents"),
});

export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>;

/**
 * Zod schema to validate policy verification rules.
 */
export const PolicyRulesSchema = z.object({
  matchClientName: z.boolean().default(true),
  expectedEmployer: z.string().optional(),
  minStatementDate: z.string().optional().describe("ISO date string for earliest allowable statement start/end date"),
  maxStatementAgeDays: z.number().optional().describe("Max allowed age of document/statement from current date in days"),
  expectedTaxYear: z.string().optional().describe("E.g., '2023' or '2024'"),
});

export type PolicyRules = z.infer<typeof PolicyRulesSchema>;
