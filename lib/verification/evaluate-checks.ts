import prisma from "@/lib/prisma";
import { DocumentExtraction, PolicyRules } from "./extraction-schema";
import { VerificationStatus, VerificationSeverity } from "@prisma/client";

export interface EvaluatedCheck {
  code: string; // e.g. CLIENT_NAME_MATCH
  pass: boolean;
  severity: VerificationSeverity;
  message: string;
  evidence?: string;
}

/**
 * Fuzzy matches two names by normalising them, splitting them into words,
 * and checking for substring presence or word intersections.
 */
export function fuzzyMatchNames(nameA?: string | null, nameB?: string | null): boolean {
  if (!nameA || !nameB) return false;

  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents/diacritics
      .replace(/[^a-z0-9\s]/g, " ") // Replace punctuation/hyphens with spaces
      .replace(/\s+/g, " ") // Collapse spaces
      .trim();

  const cleanA = clean(nameA);
  const cleanB = clean(nameB);

  if (cleanA === cleanB) return true;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  // Split into words and match individual components
  const wordsA = cleanA.split(/\s+/).filter((w) => w.length > 2);
  const wordsB = cleanB.split(/\s+/).filter((w) => w.length > 2);

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const commonWords = wordsA.filter((word) => wordsB.includes(word));
  
  // Pass if they share at least 2 words, or all words of the shorter name
  const minWordsToMatch = Math.min(2, wordsA.length, wordsB.length);
  return commonWords.length >= minWordsToMatch;
}

/**
 * Normalises and fuzzy matches two addresses.
 */
export function fuzzyMatchAddresses(addrA?: string | null, addrB?: string | null): boolean {
  if (!addrA || !addrB) return false;

  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|court|ct|boulevard|blvd|lane|ln|suite|ste|apartment|apt)\b/g, " ") // Strip suffixes
      .replace(/\s+/g, " ")
      .trim();

  const cleanA = clean(addrA);
  const cleanB = clean(addrB);

  if (cleanA === cleanB) return true;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  const wordsA = cleanA.split(" ").filter((w) => w.length > 1);
  const wordsB = cleanB.split(" ").filter((w) => w.length > 1);

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const commonWords = wordsA.filter((w) => wordsB.includes(w));
  return commonWords.length >= Math.min(3, wordsA.length, wordsB.length);
}

/**
 * Evaluates extraction facts against a verification policy and matching rules.
 */
export async function evaluateVerificationChecks(options: {
  taskId: string;
  extracted: DocumentExtraction;
  policyExpectedKind: string;
  policyRules: PolicyRules;
  clientName?: string | null;
}): Promise<{
  status: VerificationStatus;
  checks: EvaluatedCheck[];
}> {
  const { taskId, extracted, policyExpectedKind, policyRules, clientName } = options;
  const checks: EvaluatedCheck[] = [];

  // 1. Kind mismatch check (Critical)
  const kindMatch = extracted.detectedKind === policyExpectedKind;
  checks.push({
    code: "DOCUMENT_KIND_MATCH",
    pass: kindMatch,
    severity: "ERROR",
    message: kindMatch
      ? `Document kind matches expected type: ${policyExpectedKind}`
      : `Document kind mismatch. Expected: ${policyExpectedKind}, Detected: ${extracted.detectedKind}`,
    evidence: `Expected: ${policyExpectedKind}, Detected: ${extracted.detectedKind}`,
  });

  // 2. Client Name mismatch check (Critical)
  if (policyRules.matchClientName && clientName) {
    // Check both fullName and accountHolder (if bank statement)
    const nameToMatch = extracted.fullName || extracted.accountHolder;
    const nameMatch = fuzzyMatchNames(nameToMatch, clientName);
    checks.push({
      code: "CLIENT_NAME_MATCH",
      pass: nameMatch,
      severity: "ERROR",
      message: nameMatch
        ? `Document belongs to client: ${clientName}`
        : `Client name mismatch. Expected: ${clientName}, Detected: ${nameToMatch || "None"}`,
      evidence: `Expected: ${clientName}, Extracted: ${nameToMatch || "None"}`,
    });
  }

  // 3. Expiration check (Critical)
  let isExpired = false;
  if (extracted.expiryDate) {
    const expiry = new Date(extracted.expiryDate);
    isExpired = expiry < new Date();
    checks.push({
      code: "DOCUMENT_UNEXPIRED",
      pass: !isExpired,
      severity: "ERROR",
      message: !isExpired
        ? `Document is unexpired. Expiration date: ${extracted.expiryDate}`
        : `Document expired on: ${extracted.expiryDate}`,
      evidence: `Expiration date: ${extracted.expiryDate}`,
    });
  } else if (policyExpectedKind === "GOVERNMENT_ID") {
    // Government ID should typically have an expiration date
    checks.push({
      code: "DOCUMENT_UNEXPIRED",
      pass: false,
      severity: "ERROR",
      message: "No expiration date found on Government ID",
      evidence: "Expiry date is missing",
    });
  }

  // 4. Statement Period check (Warning)
  if (policyExpectedKind === "BANK_STATEMENT" || policyExpectedKind === "PAY_STUB") {
    const startStr = extracted.statementStart || extracted.payPeriodStart;
    const endStr = extracted.statementEnd || extracted.payPeriodEnd;

    let periodPass = true;
    let details = "Dates not found";

    if (startStr && endStr) {
      const start = new Date(startStr);
      const end = new Date(endStr);
      details = `Period: ${startStr} to ${endStr}`;

      if (policyRules.minStatementDate) {
        const minDate = new Date(policyRules.minStatementDate);
        if (start < minDate) {
          periodPass = false;
          details += ` (Starts before minimum date: ${policyRules.minStatementDate})`;
        }
      }

      if (policyRules.maxStatementAgeDays) {
        const maxAgeMs = policyRules.maxStatementAgeDays * 24 * 60 * 60 * 1000;
        const oldestAllowed = new Date(Date.now() - maxAgeMs);
        if (end < oldestAllowed) {
          periodPass = false;
          details += ` (Statement is too old, max allowed age: ${policyRules.maxStatementAgeDays} days)`;
        }
      }
    } else {
      periodPass = false;
    }

    checks.push({
      code: "STATEMENT_PERIOD_MATCH",
      pass: periodPass,
      severity: "WARNING",
      message: periodPass
        ? `Document period checks pass: ${details}`
        : `Document period checks fail: ${details}`,
      evidence: details,
    });
  }

  // 5. Tax Year match check (Warning)
  if (policyExpectedKind === "TAX_DOCUMENT" && policyRules.expectedTaxYear) {
    const taxYearMatch = extracted.taxYear === policyRules.expectedTaxYear;
    checks.push({
      code: "TAX_YEAR_MATCH",
      pass: taxYearMatch,
      severity: "WARNING",
      message: taxYearMatch
        ? `Tax year matches expected: ${policyRules.expectedTaxYear}`
        : `Tax year mismatch. Expected: ${policyRules.expectedTaxYear}, Detected: ${extracted.taxYear || "None"}`,
      evidence: `Expected: ${policyRules.expectedTaxYear}, Extracted: ${extracted.taxYear || "None"}`,
    });
  }

  // 6. Employer match check (Warning)
  if (
    (policyExpectedKind === "EMPLOYMENT_LETTER" || policyExpectedKind === "PAY_STUB") &&
    policyRules.expectedEmployer
  ) {
    const employerMatch =
      !!extracted.employer &&
      extracted.employer.toLowerCase().includes(policyRules.expectedEmployer.toLowerCase());
    checks.push({
      code: "EMPLOYER_MATCH",
      pass: employerMatch,
      severity: "WARNING",
      message: employerMatch
        ? `Employer matches expected: ${policyRules.expectedEmployer}`
        : `Employer mismatch. Expected: ${policyRules.expectedEmployer}, Detected: ${extracted.employer || "None"}`,
      evidence: `Expected: ${policyRules.expectedEmployer}, Extracted: ${extracted.employer || "None"}`,
    });
  }

  // 7. Low confidence score check (Warning)
  const confidenceScore = extracted.confidenceScore ?? 1.0;
  const isConfident = confidenceScore >= 0.8;
  checks.push({
    code: "LOW_CONFIDENCE",
    pass: isConfident,
    severity: "WARNING",
    message: isConfident
      ? `AI extraction confidence score is high: ${(confidenceScore * 100).toFixed(0)}%`
      : `AI extraction confidence score is low: ${(confidenceScore * 100).toFixed(0)}% (threshold: 80%)`,
    evidence: `Score: ${confidenceScore}`,
  });

  // 8. Cross-document checks
  // Find other verified analyses in the same DossierFile/dataroom
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { dataroomId: true },
  });

  if (task) {
    const otherVerifiedAnalyses = await prisma.documentAnalysis.findMany({
      where: {
        task: {
          dataroomId: task.dataroomId,
        },
        status: "VERIFIED",
        id: { not: taskId }, // Exclude current task's other analyses
      },
      select: {
        extractedData: true,
      },
    });

    const currentName = extracted.fullName || extracted.accountHolder;
    const currentAddress = extracted.address;

    let crossNameMismatch = false;
    let crossAddressMismatch = false;
    let matchedNameEvidence = "";
    let matchedAddressEvidence = "";

    for (const other of otherVerifiedAnalyses) {
      const data = other.extractedData as any;
      if (data) {
        const otherName = data.fullName || data.accountHolder;
        const otherAddress = data.address;

        if (currentName && otherName && !fuzzyMatchNames(currentName, otherName)) {
          crossNameMismatch = true;
          matchedNameEvidence = `Mismatched with name "${otherName}" from another verified document.`;
        }

        if (currentAddress && otherAddress && !fuzzyMatchAddresses(currentAddress, otherAddress)) {
          crossAddressMismatch = true;
          matchedAddressEvidence = `Mismatched with address "${otherAddress}" from another verified document.`;
        }
      }
    }

    if (currentName) {
      checks.push({
        code: "CROSS_DOCUMENT_NAME_MISMATCH",
        pass: !crossNameMismatch,
        severity: "WARNING",
        message: !crossNameMismatch
          ? "Consistent client name across all verified documents."
          : `Client name inconsistency: ${matchedNameEvidence}`,
        evidence: matchedNameEvidence || `Extracted name: ${currentName}`,
      });
    }

    if (currentAddress) {
      checks.push({
        code: "CROSS_DOCUMENT_ADDRESS_MISMATCH",
        pass: !crossAddressMismatch,
        severity: "WARNING",
        message: !crossAddressMismatch
          ? "Consistent residential address across all verified documents."
          : `Residential address inconsistency: ${matchedAddressEvidence}`,
        evidence: matchedAddressEvidence || `Extracted address: ${currentAddress}`,
      });
    }
  }

  // Determine final verification status
  // 1. Any critical error check fails -> ISSUE
  // 2. Any warning check fails, or confidence is low, or kind expected is OTHER -> NEEDS_REVIEW
  // 3. Otherwise -> VERIFIED
  const hasCriticalFailure = checks.some((c) => !c.pass && c.severity === "ERROR");
  const hasWarningFailure = checks.some((c) => !c.pass && c.severity === "WARNING");

  let status: VerificationStatus = "VERIFIED";

  if (hasCriticalFailure) {
    status = "ISSUE";
  } else if (hasWarningFailure || policyExpectedKind === "OTHER" || confidenceScore < 0.8) {
    status = "NEEDS_REVIEW";
  }

  return { status, checks };
}
