import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import crypto from "crypto";

import {
  closeTestDatabase,
  resetTestDatabase,
  seedDocument,
  seedTeam,
  seedUser,
  testPrisma,
} from "../../helpers/test-db";
import { createDossierFile } from "@/features/files/application/create-file";
import { getCompletionReadiness } from "@/features/completion/application/get-completion-readiness";
import {
  DocumentAnalysisRunStatus,
  SignatureRecipientStatus,
  SignatureRequestStatus,
  VerificationSeverity,
  VerificationStatus,
} from "@prisma/client";

type Team = Awaited<ReturnType<typeof seedTeam>>;
type User = Awaited<ReturnType<typeof seedUser>>;
type File = Awaited<ReturnType<typeof createDossierFile>>;

async function seedLink(teamId: string) {
  return testPrisma.link.create({
    data: {
      linkType: "DATAROOM_LINK",
      teamId,
    },
  });
}

async function seedPolicyTask(
  team: Team,
  user: User,
  file: File,
  overrides: { title?: string; status?: string } = {},
) {
  const task = await testPrisma.task.create({
    data: {
      taskListId: file.requirementsTaskListId!,
      dataroomId: file.dataroomId,
      teamId: team.id,
      title: overrides.title ?? "Bank Statement",
      type: "UPLOAD",
      status: overrides.status ?? "COMPLETED",
      createdByUserId: user.id,
    },
  });
  await testPrisma.dossierRequirementPolicy.create({
    data: {
      taskId: task.id,
      expectedKind: "BANK_STATEMENT",
      verificationRules: { matchClientName: true },
    },
  });
  return task;
}

async function seedTask(
  team: Team,
  user: User,
  file: File,
  overrides: { title?: string; type?: string; status?: string } = {},
) {
  return testPrisma.task.create({
    data: {
      taskListId: file.requirementsTaskListId!,
      dataroomId: file.dataroomId,
      teamId: team.id,
      title: overrides.title ?? "TODO Requirement",
      type: overrides.type ?? "TODO",
      status: overrides.status ?? "COMPLETED",
      createdByUserId: user.id,
    },
  });
}

async function seedUploadedDocument(
  team: Team,
  taskId: string,
  overrides: {
    withVersion?: boolean;
    versionNumber?: number;
    isPrimary?: boolean;
    uploadedAt?: Date;
    fileName?: string;
  } = {},
) {
  const document = await seedDocument(team.id, {
    name: overrides.fileName ?? "statement.pdf",
  });
  const link = await seedLink(team.id);

  if (overrides.withVersion !== false) {
    await testPrisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: overrides.versionNumber ?? 1,
        file: "s3://test/statement.pdf",
        contentType: "application/pdf",
        isPrimary: overrides.isPrimary ?? true,
        storageType: "S3_PATH",
      },
    });
  }

  await testPrisma.documentUpload.create({
    data: {
      documentId: document.id,
      teamId: team.id,
      linkId: link.id,
      taskId,
      originalFilename: document.name,
      mimeType: "application/pdf",
      uploadedAt: overrides.uploadedAt ?? new Date(),
    },
  });

  return document;
}

async function seedAnalysis(
  taskId: string,
  documentId: string,
  overrides: {
    runStatus?: string;
    status?: string;
    issues?: Array<{ severity?: string; dismissed?: boolean }>;
  } = {},
) {
  const version = await testPrisma.documentVersion.findFirstOrThrow({
    where: { documentId },
    orderBy: { versionNumber: "desc" },
  });

  const analysis = await testPrisma.documentAnalysis.create({
    data: {
      idempotencyKey: `verification:${taskId}:${version.id}:v1:${crypto.randomUUID()}`,
      taskId,
      documentVersionId: version.id,
      runStatus: (overrides.runStatus ??
        "COMPLETED") as DocumentAnalysisRunStatus,
      status: (overrides.status ?? "VERIFIED") as VerificationStatus,
      issues:
        overrides.issues && overrides.issues.length > 0
          ? {
              create: overrides.issues.map((issue, index) => ({
                checkCode: `CHECK_${index}`,
                severity: (issue.severity ??
                  "ERROR") as VerificationSeverity,
                message: `Issue ${index}`,
                dismissed: issue.dismissed ?? false,
                dismissedByUserId:
                  issue.dismissed === true ? undefined : null,
                dismissedAt:
                  issue.dismissed === true ? new Date() : null,
                dismissalReason:
                  issue.dismissed === true ? "Reviewed manually" : null,
              })),
            }
          : undefined,
    },
  });

  return { analysis, version };
}

async function seedSignatureRequest(
  team: Team,
  file: File,
  overrides: {
    status?: string;
    recipientStatus?: string;
    artifactSha?: string | null;
  } = {},
) {
  const document = await seedDocument(team.id, {
    name: "agreement.pdf",
  });
  const template = await testPrisma.signatureTemplate.create({
    data: {
      teamId: team.id,
      documentId: document.id,
      name: "Agreement",
      provider: "DOCUMENSO",
      providerExternalId: `sig-template-${crypto.randomUUID()}`,
    },
  });

  const request = await testPrisma.signatureRequest.create({
    data: {
      teamId: team.id,
      documentId: document.id,
      templateId: template.id,
      providerExternalId: `sig-req-${crypto.randomUUID()}`,
      status: (overrides.status ?? "COMPLETED") as SignatureRequestStatus,
      dossierFileId: file.id,
      recipients: {
        create: {
          status: (overrides.recipientStatus ??
            "SIGNED") as SignatureRecipientStatus,
        },
      },
      artifact:
        overrides.artifactSha != null
          ? {
              create: {
                storageKey: "s3://signed/agreement.pdf",
                fileName: "agreement_signed.pdf",
                mimeType: "application/pdf",
                sha256: overrides.artifactSha,
                sizeBytes: BigInt(1024),
              },
            }
          : undefined,
    },
    include: { recipients: true, artifact: true },
  });

  return request;
}

async function setupFile(overrides: { requiresSignature?: boolean } = {}) {
  const team = await seedTeam();
  const user = await seedUser({
    email: `user-${crypto.randomUUID()}@example.com`,
  });
  const file = await createDossierFile({
    teamId: team.id,
    userId: user.id,
    title: "Completion Readiness Case",
    requiresSignature: overrides.requiresSignature ?? false,
  });
  return { team, user, file };
}

describe("completion readiness (integration)", () => {
  before(async () => {
    await resetTestDatabase();
  });

  after(async () => {
    await closeTestDatabase();
  });

  it("1. incomplete requirement -> REQUIREMENTS_INCOMPLETE", async () => {
    const { team, user, file } = await setupFile();
    await seedTask(team, user, file, { status: "OPEN" });
    const readiness = await getCompletionReadiness(file.id);
    assert.strictEqual(readiness.ready, false);
    assert.deepEqual(readiness.blockers.map((b) => b.code), [
      "REQUIREMENTS_INCOMPLETE",
    ]);
  });

  it("2. completed UPLOAD requirement with policy but no DocumentUpload -> DOCUMENT_MISSING", async () => {
    const { team, user, file } = await setupFile();
    await seedPolicyTask(team, user, file);
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["DOCUMENT_MISSING"]);
  });

  it("3. document exists but version missing -> DOCUMENT_VERSION_MISSING", async () => {
    const { team, user, file } = await setupFile();
    const task = await seedPolicyTask(team, user, file);
    await seedUploadedDocument(team, task.id, { withVersion: false });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), [
      "DOCUMENT_VERSION_MISSING",
    ]);
  });

  it("4. policy-backed requirement has no analysis -> VERIFICATION_MISSING", async () => {
    const { team, user, file } = await setupFile();
    const task = await seedPolicyTask(team, user, file);
    await seedUploadedDocument(team, task.id);
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["VERIFICATION_MISSING"]);
  });

  it("5. analysis PENDING -> VERIFICATION_PENDING", async () => {
    const { team, user, file } = await setupFile();
    const task = await seedPolicyTask(team, user, file);
    const document = await seedUploadedDocument(team, task.id);
    await seedAnalysis(task.id, document.id, { runStatus: "PENDING", status: "PENDING" });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["VERIFICATION_PENDING"]);
  });

  it("6. analysis PROCESSING -> VERIFICATION_PENDING", async () => {
    const { team, user, file } = await setupFile();
    const task = await seedPolicyTask(team, user, file);
    const document = await seedUploadedDocument(team, task.id);
    await seedAnalysis(task.id, document.id, { runStatus: "PROCESSING", status: "PENDING" });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["VERIFICATION_PENDING"]);
  });

  it("7. analysis FAILED -> VERIFICATION_FAILED", async () => {
    const { team, user, file } = await setupFile();
    const task = await seedPolicyTask(team, user, file);
    const document = await seedUploadedDocument(team, task.id);
    await seedAnalysis(task.id, document.id, { runStatus: "FAILED", status: "ISSUE" });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["VERIFICATION_FAILED"]);
  });

  it("8. completed analysis status ISSUE -> VERIFICATION_UNRESOLVED", async () => {
    const { team, user, file } = await setupFile();
    const task = await seedPolicyTask(team, user, file);
    const document = await seedUploadedDocument(team, task.id);
    await seedAnalysis(task.id, document.id, { status: "ISSUE" });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["VERIFICATION_UNRESOLVED"]);
  });

  it("9. VERIFIED but active WARNING -> VERIFICATION_UNRESOLVED", async () => {
    const { team, user, file } = await setupFile();
    const task = await seedPolicyTask(team, user, file);
    const document = await seedUploadedDocument(team, task.id);
    await seedAnalysis(task.id, document.id, {
      status: "VERIFIED",
      issues: [{ severity: "WARNING", dismissed: false }],
    });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["VERIFICATION_UNRESOLVED"]);
  });

  it("10. VERIFIED but active ERROR -> VERIFICATION_UNRESOLVED", async () => {
    const { team, user, file } = await setupFile();
    const task = await seedPolicyTask(team, user, file);
    const document = await seedUploadedDocument(team, task.id);
    await seedAnalysis(task.id, document.id, {
      status: "VERIFIED",
      issues: [{ severity: "ERROR", dismissed: false }],
    });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["VERIFICATION_UNRESOLVED"]);
  });

  it("11. dismissed warning with reason does not block", async () => {
    const { team, user, file } = await setupFile();
    const task = await seedPolicyTask(team, user, file);
    const document = await seedUploadedDocument(team, task.id);
    await seedAnalysis(task.id, document.id, {
      status: "VERIFIED",
      issues: [{ severity: "WARNING", dismissed: true }],
    });
    const readiness = await getCompletionReadiness(file.id);
    assert.strictEqual(readiness.ready, true);
    assert.deepEqual(readiness.blockers, []);
    assert.strictEqual(readiness.summary.verificationResolved, 1);
  });

  it("12. old uploaded document VERIFIED but latest uploaded version has no analysis -> VERIFICATION_MISSING", async () => {
    const { team, user, file } = await setupFile();
    const task = await seedPolicyTask(team, user, file);
    const oldDocument = await seedUploadedDocument(team, task.id, {
      uploadedAt: new Date(Date.now() - 100_000),
      fileName: "old-statement.pdf",
    });
    await seedAnalysis(task.id, oldDocument.id, { status: "VERIFIED" });
    await seedUploadedDocument(team, task.id, {
      uploadedAt: new Date(),
      fileName: "new-statement.pdf",
    });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["VERIFICATION_MISSING"]);
  });

  it("13. no signature required -> signature checks pass", async () => {
    const { team, user, file } = await setupFile({ requiresSignature: false });
    await seedTask(team, user, file);
    const readiness = await getCompletionReadiness(file.id);
    assert.strictEqual(readiness.summary.signatureRequired, false);
    assert.strictEqual(readiness.summary.signatureComplete, true);
    assert.strictEqual(readiness.summary.signedArtifactReady, true);
    assert.strictEqual(readiness.blockers.length, 0);
  });

  it("14. signature required but no request -> SIGNATURE_REQUIRED_NOT_STARTED", async () => {
    const { team, user, file } = await setupFile({ requiresSignature: true });
    await seedTask(team, user, file);
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), [
      "SIGNATURE_REQUIRED_NOT_STARTED",
    ]);
  });

  it("15. active signature request -> SIGNATURE_INCOMPLETE", async () => {
    const { team, user, file } = await setupFile({ requiresSignature: true });
    await seedTask(team, user, file);
    await seedSignatureRequest(team, file, {
      status: "SENT",
      recipientStatus: "PENDING",
    });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["SIGNATURE_INCOMPLETE"]);
  });

  it("16. COMPLETED request but recipient not SIGNED -> SIGNATURE_INCOMPLETE", async () => {
    const { team, user, file } = await setupFile({ requiresSignature: true });
    await seedTask(team, user, file);
    await seedSignatureRequest(team, file, {
      status: "COMPLETED",
      recipientStatus: "PENDING",
      artifactSha: crypto.createHash("sha256").update("x").digest("hex"),
    });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["SIGNATURE_INCOMPLETE"]);
  });

  it("17. COMPLETED + all recipients signed but no SignatureArtifact -> SIGNED_ARTIFACT_MISSING", async () => {
    const { team, user, file } = await setupFile({ requiresSignature: true });
    await seedTask(team, user, file);
    await seedSignatureRequest(team, file, {
      status: "COMPLETED",
      recipientStatus: "SIGNED",
      artifactSha: null,
    });
    const readiness = await getCompletionReadiness(file.id);
    assert.deepEqual(readiness.blockers.map((b) => b.code), ["SIGNED_ARTIFACT_MISSING"]);
    assert.strictEqual(readiness.summary.signatureComplete, true);
    assert.strictEqual(readiness.summary.signedArtifactReady, false);
  });

  it("18. COMPLETED + all signed + artifact sha256 -> signing ready", async () => {
    const { team, user, file } = await setupFile({ requiresSignature: true });
    await seedTask(team, user, file);
    await seedSignatureRequest(team, file, {
      status: "COMPLETED",
      recipientStatus: "SIGNED",
      artifactSha: crypto.createHash("sha256").update("signed").digest("hex"),
    });
    const readiness = await getCompletionReadiness(file.id);
    assert.strictEqual(readiness.summary.signatureComplete, true);
    assert.strictEqual(readiness.summary.signedArtifactReady, true);
    assert.strictEqual(readiness.blockers.length, 0);
  });

  it("19. everything clean -> ready=true, blockers=[]", async () => {
    const { team, user, file } = await setupFile();
    await seedTask(team, user, file, { title: "Employment letter", type: "TODO" });
    const readiness = await getCompletionReadiness(file.id);
    assert.strictEqual(readiness.ready, true);
    assert.deepEqual(readiness.blockers, []);
    assert.strictEqual(readiness.summary.requirementsTotal, 1);
    assert.strictEqual(readiness.summary.requirementsCompleted, 1);
  });
});
