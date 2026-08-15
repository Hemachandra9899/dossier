import { test } from "node:test";
import assert from "node:assert";
import {
  fuzzyMatchNames,
  fuzzyMatchAddresses,
  evaluateVerificationChecks,
} from "@/features/verification/verification.rules";

test("Verification Rules Engine", async (t) => {
  await t.test("Fuzzy Name Matching", () => {
    // Exact matches
    assert.strictEqual(fuzzyMatchNames("John Doe", "John Doe"), true);
    assert.strictEqual(fuzzyMatchNames("john doe", "John Doe"), true);

    // Minor whitespace/punctuation
    assert.strictEqual(fuzzyMatchNames("John  Doe", "John Doe"), true);
    assert.strictEqual(fuzzyMatchNames("John-Doe", "John Doe"), true);

    // Transliteration / diacritics removal
    assert.strictEqual(fuzzyMatchNames("René Dupont", "Rene Dupont"), true);

    // Substrings / titles
    assert.strictEqual(fuzzyMatchNames("Mr. John Doe III", "John Doe"), true);
    assert.strictEqual(fuzzyMatchNames("Dr Jane Smith Jr", "Jane Smith"), true);

    // Non-matching
    assert.strictEqual(fuzzyMatchNames("John Doe", "Jane Doe"), false);
    assert.strictEqual(fuzzyMatchNames("John Smith", "William Smith"), false);
    assert.strictEqual(fuzzyMatchNames(null, "John"), false);
  });

  await t.test("Fuzzy Address Matching", () => {
    // Exact matches & suffix expansions
    assert.strictEqual(fuzzyMatchAddresses("123 Main St", "123 Main Street"), true);
    assert.strictEqual(fuzzyMatchAddresses("555 Parkway Ave, Suite 4", "555 Parkway Avenue Suite 4"), true);

    // Slight casing/formatting
    assert.strictEqual(fuzzyMatchAddresses("123 main st, springfield", "123 Main St Springfield"), true);

    // Mismatch
    assert.strictEqual(fuzzyMatchAddresses("123 Main St", "456 Main St"), false);
  });

  await t.test("Checks Evaluation rules", async () => {
    const extracted = {
      detectedKind: "GOVERNMENT_ID" as const,
      confidenceScore: 0.95,
      fullName: "John Doe",
      address: "123 Main St, Springfield",
      dateOfBirth: "1990-01-01",
      documentNumber: "ID-12345",
      issueDate: "2020-01-01",
      expiryDate: "2030-01-01",
      accountHolder: null,
      statementStart: null,
      statementEnd: null,
      employer: null,
      payPeriodStart: null,
      payPeriodEnd: null,
      taxYear: null,
    };

    const rules = {
      matchClientName: true,
    };

    // All passing GOVERNMENT_ID -> VERIFIED
    const result = await evaluateVerificationChecks({
      taskId: "test-task",
      extracted,
      policyExpectedKind: "GOVERNMENT_ID",
      policyRules: rules,
      clientName: "John Doe",
    });

    assert.strictEqual(result.status, "VERIFIED");
    const kindCheck = result.checks.find(c => c.code === "DOCUMENT_KIND_MATCH");
    assert.strictEqual(kindCheck?.pass, true);
    const nameCheck = result.checks.find(c => c.code === "CLIENT_NAME_MATCH");
    assert.strictEqual(nameCheck?.pass, true);

    // Name mismatch -> ISSUE
    const badNameResult = await evaluateVerificationChecks({
      taskId: "test-task",
      extracted,
      policyExpectedKind: "GOVERNMENT_ID",
      policyRules: rules,
      clientName: "Jane Smith",
    });
    assert.strictEqual(badNameResult.status, "ISSUE");
    const badNameCheck = badNameResult.checks.find(c => c.code === "CLIENT_NAME_MATCH");
    assert.strictEqual(badNameCheck?.pass, false);

    // Kind mismatch -> ISSUE
    const badKindResult = await evaluateVerificationChecks({
      taskId: "test-task",
      extracted,
      policyExpectedKind: "BANK_STATEMENT",
      policyRules: rules,
      clientName: "John Doe",
    });
    assert.strictEqual(badKindResult.status, "ISSUE");

    // Expired document -> ISSUE
    const expiredExtracted = {
      ...extracted,
      expiryDate: "2022-01-01",
    };
    const expiredResult = await evaluateVerificationChecks({
      taskId: "test-task",
      extracted: expiredExtracted,
      policyExpectedKind: "GOVERNMENT_ID",
      policyRules: rules,
      clientName: "John Doe",
    });
    assert.strictEqual(expiredResult.status, "ISSUE");
  });
});
