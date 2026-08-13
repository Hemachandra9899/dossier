import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import crypto from "crypto";
import {
  closeTestDatabase,
  resetTestDatabase,
  seedTeam,
  seedUser,
  testPrisma,
} from "@/tests/helpers/test-db";
import { createDossierFile } from "@/modules/files/application/create-file";
import { evaluateVerificationChecks } from "@/lib/verification/evaluate-checks";

describe("document verification workflows (integration)", () => {
  before(async () => {
    await resetTestDatabase();
  });

  after(async () => {
    await closeTestDatabase();
  });

  it("creates requirement policy from file template check-lists", async () => {
    const team = await seedTeam();
    const user = await seedUser({ email: `user-${crypto.randomUUID()}@example.com` });

    // 1. Create template with expected verification fields
    const template = await testPrisma.dossierFileTemplate.create({
      data: {
        key: `test-verification-${crypto.randomUUID()}`,
        name: "Verification Case",
        isGlobal: true,
        requirements: {
          create: [
            {
              title: "Government Identification",
              type: "UPLOAD",
              expectedKind: "GOVERNMENT_ID",
              verificationRules: { matchClientName: true },
            },
          ],
        },
      },
    });

    // 2. Create Dossier File using template
    const file = await createDossierFile({
      teamId: team.id,
      userId: user.id,
      title: "Mortgage Verification",
      clientName: "John Doe",
      clientEmail: "john-doe@example.com",
      templateId: template.id,
    });

    // 3. Find created task and assert policy was created
    const task = await testPrisma.task.findFirst({
      where: { taskListId: file.requirementsTaskListId! },
      include: { policy: true },
    });

    assert.ok(task);
    assert.strictEqual(task.title, "Government Identification");
    assert.ok(task.policy);
    assert.strictEqual(task.policy.expectedKind, "GOVERNMENT_ID");
    
    const rules = task.policy.verificationRules as any;
    assert.strictEqual(rules.matchClientName, true);
  });

  it("evaluates checks and flags mismatches as verification issues", async () => {
    const rules = {
      matchClientName: true,
    };

    // Case A: Perfect match (VERIFIED)
    const mockFactsMatch = {
      detectedKind: "GOVERNMENT_ID" as const,
      confidenceScore: 0.98,
      fullName: "John Doe",
      address: "123 Main St",
      dateOfBirth: "1990-01-01",
      documentNumber: "DL-11111",
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

    const matchRes = await evaluateVerificationChecks({
      taskId: "test-task-match",
      extracted: mockFactsMatch,
      policyExpectedKind: "GOVERNMENT_ID",
      policyRules: rules,
      clientName: "John Doe",
    });
    assert.strictEqual(matchRes.status, "VERIFIED");
    assert.strictEqual(matchRes.checks.every(c => c.pass), true);

    // Case B: Name mismatch (ISSUE status, CLIENT_NAME_MATCH fail)
    const mockFactsMismatchName = {
      ...mockFactsMatch,
      fullName: "Jane Doe",
    };

    const mismatchNameRes = await evaluateVerificationChecks({
      taskId: "test-task-mismatch-name",
      extracted: mockFactsMismatchName,
      policyExpectedKind: "GOVERNMENT_ID",
      policyRules: rules,
      clientName: "John Doe",
    });
    assert.strictEqual(mismatchNameRes.status, "ISSUE");
    
    const nameCheck = mismatchNameRes.checks.find(c => c.code === "CLIENT_NAME_MATCH");
    assert.strictEqual(nameCheck?.pass, false);
    assert.strictEqual(nameCheck?.severity, "ERROR");

    // Case C: Kind mismatch (ISSUE status, DOCUMENT_KIND_MATCH fail)
    const mockFactsMismatchKind = {
      ...mockFactsMatch,
      detectedKind: "BANK_STATEMENT" as const,
    };

    const mismatchKindRes = await evaluateVerificationChecks({
      taskId: "test-task-mismatch-kind",
      extracted: mockFactsMismatchKind,
      policyExpectedKind: "GOVERNMENT_ID",
      policyRules: rules,
      clientName: "John Doe",
    });
    assert.strictEqual(mismatchKindRes.status, "ISSUE");
    
    const kindCheck = mismatchKindRes.checks.find(c => c.code === "DOCUMENT_KIND_MATCH");
    assert.strictEqual(kindCheck?.pass, false);
    assert.strictEqual(kindCheck?.severity, "ERROR");
  });
});
