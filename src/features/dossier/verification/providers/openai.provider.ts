import { getOpenAI } from "@/lib/openai";
import { DocumentExtraction, DocumentExtractionSchema, DocumentKind } from "../verification.types";

/**
 * Extracts facts from a document using OpenAI chat completions with structured JSON outputs.
 * Fallbacks to a mock response if no API key is provided, or in test environments.
 */
export async function extractDocumentFacts(options: {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  expectedKind: DocumentKind;
}): Promise<DocumentExtraction> {
  const { fileBuffer, fileName, mimeType, expectedKind } = options;

  // Use mock provider only in test environment
  const useMock = process.env.NODE_ENV === "test";

  if (useMock) {
    return getMockExtraction(fileName, expectedKind);
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Verification provider is not configured");
  }

  try {
    const openai = getOpenAI();

    // 1. Upload file to OpenAI with vision/assistants purpose
    const file = new File([fileBuffer as any], fileName, { type: mimeType });
    const fileResponse = await openai.files.create({
      file,
      purpose: "assistants", // required for vision/PDF input in Completions
    });

    // 2. Call the beta completions parser with Zod schema
    const prompt = `You are an expert document verification assistant.
Analyze the attached document and extract key facts accurately.
The user expects this document to be a "${expectedKind}".
Extract all fields that are present in the document. For fields not relevant to the document type, or not found, return null.
Perform OCR and parse text and tables from all pages of the document.`;

    const response = await (openai as any).responses.parse({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional document extraction system. Adhere strictly to the requested schema.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "input_file",
              file_id: fileResponse.id,
            },
          ],
        },
      ],
      response_format: DocumentExtractionSchema,
      temperature: 0.1,
    });

    const extraction = (response as any).output_parsed;
    if (!extraction) {
      throw new Error("OpenAI failed to return structured extraction results.");
    }

    // Try to delete the uploaded file in the background (cleanup)
    try {
      await openai.files.delete(fileResponse.id);
    } catch (cleanupErr) {
      console.warn("Failed to delete OpenAI file during cleanup:", cleanupErr);
    }

    return extraction;
  } catch (error) {
    console.error("OpenAI Document Analysis failed:", error);
    throw error;
  }
}

/**
 * Returns mock extraction results based on the filename and expected kind
 * for testing and local development.
 */
function getMockExtraction(fileName: string, expectedKind: DocumentKind): DocumentExtraction {
  const normalizedName = fileName.toLowerCase();

  // Baseline extraction matching client "John Doe"
  const baseline: DocumentExtraction = {
    detectedKind: expectedKind,
    confidenceScore: 0.95,
    fullName: "John Doe",
    address: "123 Main St, Springfield",
    dateOfBirth: "1990-01-01",
    documentNumber: "ID-99999",
    issueDate: "2020-01-01",
    expiryDate: "2030-01-01",
    accountHolder: "John Doe",
    statementStart: "2024-01-01",
    statementEnd: "2024-01-31",
    employer: "Acme Corp",
    payPeriodStart: "2024-06-01",
    payPeriodEnd: "2024-06-15",
    taxYear: "2023",
  };

  // 1. Force wrong kind mismatch
  if (normalizedName.includes("wrong-kind") || normalizedName.includes("wrong")) {
    baseline.detectedKind = expectedKind === "GOVERNMENT_ID" ? "BANK_STATEMENT" : "GOVERNMENT_ID";
    return baseline;
  }

  // 2. Force name mismatch
  if (normalizedName.includes("mismatch-name") || normalizedName.includes("mismatch")) {
    baseline.fullName = "Jane Smith";
    baseline.accountHolder = "Jane Smith";
    return baseline;
  }

  // 3. Force expired document
  if (normalizedName.includes("expired")) {
    baseline.expiryDate = "2022-01-01";
    return baseline;
  }

  // 4. Force low confidence
  if (normalizedName.includes("low-confidence")) {
    baseline.confidenceScore = 0.65;
    return baseline;
  }

  // Populate specific fields based on expected kind defaults
  switch (expectedKind) {
    case "GOVERNMENT_ID":
      return {
        ...baseline,
        accountHolder: null,
        statementStart: null,
        statementEnd: null,
        employer: null,
        payPeriodStart: null,
        payPeriodEnd: null,
        taxYear: null,
      };

    case "BANK_STATEMENT":
      return {
        ...baseline,
        dateOfBirth: null,
        issueDate: null,
        expiryDate: null,
        employer: null,
        payPeriodStart: null,
        payPeriodEnd: null,
        taxYear: null,
      };

    case "PAY_STUB":
      return {
        ...baseline,
        dateOfBirth: null,
        issueDate: null,
        expiryDate: null,
        accountHolder: null,
        statementStart: null,
        statementEnd: null,
        taxYear: null,
      };

    case "EMPLOYMENT_LETTER":
      return {
        ...baseline,
        dateOfBirth: null,
        expiryDate: null,
        accountHolder: null,
        statementStart: null,
        statementEnd: null,
        payPeriodStart: null,
        payPeriodEnd: null,
        taxYear: null,
      };

    case "TAX_DOCUMENT":
      return {
        ...baseline,
        dateOfBirth: null,
        issueDate: null,
        expiryDate: null,
        accountHolder: null,
        statementStart: null,
        statementEnd: null,
        employer: null,
        payPeriodStart: null,
        payPeriodEnd: null,
      };

    case "OTHER":
    default:
      return baseline;
  }
}
