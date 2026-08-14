import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import crypto from "crypto";

import "@/tests/helpers/mock-session";
import { sessionState } from "@/tests/helpers/mock-session";
import { mockReq, mockRes } from "@/tests/helpers/mock-api";
import {
  closeTestDatabase,
  resetTestDatabase,
  seedTeam,
  seedUser,
  testPrisma,
} from "@/tests/helpers/test-db";
import { createDossierFile } from "@/modules/files/application/create-file";
import { createCompletionRun } from "@/modules/completion/application/create-completion-run";
import { default as completionHandler } from "@/pages/api/files/[fileId]/completion/index";
import { default as recordHandler } from "@/pages/api/files/[fileId]/completion/[recordId]";

type Team = Awaited<ReturnType<typeof seedTeam>>;
type User = Awaited<ReturnType<typeof seedUser>>;
type File = Awaited<ReturnType<typeof createDossierFile>>;

async function setupFile(
  overrides: {
    status?: string;
    requiresSignature?: boolean;
  } = {},
): Promise<{ team: Team; user: User; file: File }> {
  const team = await seedTeam();
  const user = await seedUser({
    email: `user-${crypto.randomUUID()}@example.com`,
  });
  const file = await createDossierFile({
    teamId: team.id,
    userId: user.id,
    title: "Completion Run Case",
    requiresSignature: overrides.requiresSignature ?? false,
  });

  if (overrides.status) {
    await testPrisma.dossierFile.update({
      where: { id: file.id },
      data: { status: overrides.status as never },
    });
  }

  return { team, user, file };
}

async function addMember(
  team: Team,
  user: User,
  role: string,
  file?: File,
) {
  await testPrisma.userTeam.create({
    data: { teamId: team.id, userId: user.id, role: role as never },
  });
  if (file) {
    await testPrisma.userDataroom.create({
      data: {
        userId: user.id,
        teamId: team.id,
        dataroomId: file.dataroomId,
      },
    });
  }
}

async function seedTask(
  team: Team,
  user: User,
  file: File,
  overrides: { title?: string; status?: string } = {},
) {
  return testPrisma.task.create({
    data: {
      taskListId: file.requirementsTaskListId!,
      dataroomId: file.dataroomId,
      teamId: team.id,
      title: overrides.title ?? "TODO Requirement",
      type: "TODO",
      status: overrides.status ?? "OPEN",
      createdByUserId: user.id,
    },
  });
}

async function postCompletion(fileId: string) {
  const res = mockRes();
  await completionHandler(
    mockReq({ method: "POST", query: { fileId } }),
    res,
  );
  return res;
}

async function getCompletion(fileId: string) {
  const res = mockRes();
  await completionHandler(mockReq({ method: "GET", query: { fileId } }), res);
  return res;
}

async function getRecordDetail(fileId: string, recordId: string) {
  const res = mockRes();
  await recordHandler(
    mockReq({ method: "GET", query: { fileId, recordId } }),
    res,
  );
  return res;
}

describe("completion run creation (integration)", () => {
  before(async () => {
    await resetTestDatabase();
  });

  after(async () => {
    await closeTestDatabase();
  });

  it("1. NEW file -> 409 FILE_NOT_READY_TO_CLOSE", async () => {
    const { team, user, file } = await setupFile({ status: "NEW" });
    await addMember(team, user, "ADMIN", file);

    sessionState.userId = user.id;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 409);
    assert.deepEqual(
      (res.body as { code?: string }).code,
      "FILE_NOT_READY_TO_CLOSE",
    );
  });

  it("2. COLLECTING file -> 409 FILE_NOT_READY_TO_CLOSE", async () => {
    const { team, user, file } = await setupFile({ status: "COLLECTING" });
    await addMember(team, user, "ADMIN", file);

    sessionState.userId = user.id;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 409);
    assert.deepEqual(
      (res.body as { code?: string }).code,
      "FILE_NOT_READY_TO_CLOSE",
    );
  });

  it("3. REVIEWING file -> 409 FILE_NOT_READY_TO_CLOSE", async () => {
    const { team, user, file } = await setupFile({ status: "REVIEWING" });
    await addMember(team, user, "ADMIN", file);

    sessionState.userId = user.id;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 409);
    assert.deepEqual(
      (res.body as { code?: string }).code,
      "FILE_NOT_READY_TO_CLOSE",
    );
  });

  it("4. READY_TO_SIGN file -> 409 FILE_NOT_READY_TO_CLOSE", async () => {
    const { team, user, file } = await setupFile({ status: "READY_TO_SIGN" });
    await addMember(team, user, "ADMIN", file);

    sessionState.userId = user.id;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 409);
    assert.deepEqual(
      (res.body as { code?: string }).code,
      "FILE_NOT_READY_TO_CLOSE",
    );
  });

  it("5. SIGNING file -> 409 FILE_NOT_READY_TO_CLOSE", async () => {
    const { team, user, file } = await setupFile({ status: "SIGNING" });
    await addMember(team, user, "ADMIN", file);

    sessionState.userId = user.id;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 409);
    assert.deepEqual(
      (res.body as { code?: string }).code,
      "FILE_NOT_READY_TO_CLOSE",
    );
  });

  it("6. READY_TO_CLOSE with incomplete requirement -> 409 FILE_HAS_COMPLETION_BLOCKERS", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");
    await seedTask(team, user, file, { status: "OPEN" });

    sessionState.userId = user.id;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 409);
    const body = res.body as { code?: string; blockers?: Array<{ code: string }> };
    assert.deepEqual(body.code, "FILE_HAS_COMPLETION_BLOCKERS");
    assert.ok(Array.isArray(body.blockers));
    assert.deepEqual(body.blockers!.map((b) => b.code), [
      "REQUIREMENTS_INCOMPLETE",
    ]);
  });

  it("7. READY_TO_CLOSE with missing signature -> 409 with signature blocker", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
      requiresSignature: true,
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = user.id;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 409);
    const body = res.body as { code?: string; blockers?: Array<{ code: string }> };
    assert.deepEqual(body.code, "FILE_HAS_COMPLETION_BLOCKERS");
    assert.deepEqual(body.blockers!.map((b) => b.code), [
      "SIGNATURE_REQUIRED_NOT_STARTED",
    ]);
  });

  it("8. clean READY_TO_CLOSE -> 202 run PENDING", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = user.id;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 202);
    const run = (res.body as { run: { id: string; status: string; initiatedById: string } }).run;
    assert.ok(run.id);
    assert.strictEqual(run.status, "PENDING");
    assert.strictEqual(run.initiatedById, user.id);
  });

  it("9. repeat POST returns the same run and creates only one run", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = user.id;
    const first = await postCompletion(file.id);
    const second = await postCompletion(file.id);

    assert.strictEqual(first.statusCode, 202);
    assert.strictEqual(second.statusCode, 202);

    const firstRun = (first.body as { run: { id: string } }).run;
    const secondRun = (second.body as { run: { id: string } }).run;
    assert.strictEqual(secondRun.id, firstRun.id);

    const count = await testPrisma.dossierCompletionRun.count({
      where: { dossierFileId: file.id },
    });
    assert.strictEqual(count, 1);
  });

  it("10. concurrent POSTs create exactly one run", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    const [r1, r2] = await Promise.all([
      createCompletionRun({ fileId: file.id, initiatedById: user.id }),
      createCompletionRun({ fileId: file.id, initiatedById: user.id }),
    ]);

    assert.strictEqual(r1.id, r2.id);
    const count = await testPrisma.dossierCompletionRun.count({
      where: { dossierFileId: file.id },
    });
    assert.strictEqual(count, 1);
  });

  it("11. DATAROOM_MEMBER -> 403 on POST", async () => {
    const { team, file } = await setupFile({ status: "READY_TO_CLOSE" });
    const scopedUser = await seedUser({
      email: `scoped-${crypto.randomUUID()}@example.com`,
    });
    await addMember(team, scopedUser, "DATAROOM_MEMBER", file);

    sessionState.userId = scopedUser.id;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 403);
  });

  it("12. member of another team -> 403 on POST", async () => {
    const { file } = await setupFile({ status: "READY_TO_CLOSE" });
    const otherTeam = await seedTeam();
    const outsider = await seedUser({
      email: `outsider-${crypto.randomUUID()}@example.com`,
    });
    await addMember(otherTeam, outsider, "ADMIN");

    sessionState.userId = outsider.id;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 403);
  });

  it("13. POST does not mutate file status or completedAt", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = user.id;
    await postCompletion(file.id);

    const refreshed = await testPrisma.dossierFile.findUniqueOrThrow({
      where: { id: file.id },
    });
    assert.strictEqual(refreshed.status, "READY_TO_CLOSE");
    assert.strictEqual(refreshed.completedAt, null);
  });

  it("14. POST writes no FILE_COMPLETED activity", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = user.id;
    await postCompletion(file.id);

    const activities = await testPrisma.dossierFileActivity.findMany({
      where: { fileId: file.id },
    });
    assert.ok(activities.every((activity) => activity.type !== "FILE_COMPLETED"));
  });

  it("15. POST creates no completion records or artifacts", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = user.id;
    await postCompletion(file.id);

    const records = await testPrisma.dossierCompletionRecord.count({
      where: { dossierFileId: file.id },
    });
    assert.strictEqual(records, 0);
    const artifacts = await testPrisma.dossierCompletionArtifact.count();
    assert.strictEqual(artifacts, 0);
  });

  it("16. GET before any run -> latestRun null, latestRecord null", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = user.id;
    const res = await getCompletion(file.id);

    assert.strictEqual(res.statusCode, 200);
    const body = res.body as { latestRun: unknown; latestRecord: unknown };
    assert.strictEqual(body.latestRun, null);
    assert.strictEqual(body.latestRecord, null);
  });

  it("17. GET after POST -> latestRun matches and exposes no snapshot", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = user.id;
    const created = await postCompletion(file.id);
    const runId = (created.body as { run: { id: string } }).run.id;

    const res = await getCompletion(file.id);
    assert.strictEqual(res.statusCode, 200);

    const body = res.body as {
      latestRun: Record<string, unknown> | null;
      latestRecord: unknown;
    };
    assert.ok(body.latestRun);
    assert.strictEqual(body.latestRun.id, runId);
    assert.strictEqual(body.latestRun.status, "PENDING");
    assert.strictEqual(body.latestRun.record, null);
    assert.strictEqual(body.latestRecord, null);
    assert.ok(!("snapshot" in body.latestRun));
  });

  it("18. GET unknown record -> 404", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = user.id;
    const res = await getRecordDetail(file.id, "missing-record-id");

    assert.strictEqual(res.statusCode, 404);
  });

  it("19. record detail returns snapshot + artifacts without storageKey", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    const run = await testPrisma.dossierCompletionRun.create({
      data: {
        dossierFileId: file.id,
        initiatedById: user.id,
        idempotencyKey: `completion:${file.id}:v1`,
        status: "COMPLETED",
      },
    });
    const record = await testPrisma.dossierCompletionRecord.create({
      data: {
        dossierFileId: file.id,
        runId: run.id,
        version: 1,
        schemaVersion: 1,
        snapshot: { finalized: true },
        manifestHash: "test-manifest-hash",
        completedById: user.id,
        completedAt: new Date(),
        artifacts: {
          create: {
            kind: "SIGNED_DOCUMENT",
            fileName: "agreement_signed.pdf",
            mimeType: "application/pdf",
            sizeBytes: BigInt(1234),
            sha256: "test-sha",
            storageType: "S3_PATH",
            storageKey: "s3://secret/agreement_signed.pdf",
          },
        },
      },
    });

    sessionState.userId = user.id;
    const res = await getRecordDetail(file.id, record.id);

    assert.strictEqual(res.statusCode, 200);
    const body = res.body as Record<string, any>;
    assert.strictEqual(body.version, 1);
    assert.strictEqual(body.schemaVersion, 1);
    assert.strictEqual(body.manifestHash, "test-manifest-hash");
    assert.deepEqual(body.snapshot, { finalized: true });
    assert.strictEqual(body.artifacts.length, 1);
    assert.strictEqual(body.artifacts[0].sizeBytes, "1234");
    assert.strictEqual(body.artifacts[0].storageKey, undefined);
  });

  it("20. record of another file -> 404", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    const other = await setupFile({ status: "READY_TO_CLOSE" });
    const run = await testPrisma.dossierCompletionRun.create({
      data: {
        dossierFileId: other.file.id,
        initiatedById: other.user.id,
        idempotencyKey: `completion:${other.file.id}:v1`,
        status: "COMPLETED",
      },
    });
    const record = await testPrisma.dossierCompletionRecord.create({
      data: {
        dossierFileId: other.file.id,
        runId: run.id,
        version: 1,
        schemaVersion: 1,
        snapshot: {},
        manifestHash: "hash",
        completedById: other.user.id,
        completedAt: new Date(),
      },
    });

    sessionState.userId = user.id;
    const res = await getRecordDetail(file.id, record.id);

    assert.strictEqual(res.statusCode, 404);
  });

  it("21. unauthenticated POST -> 401", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = null;
    const res = await postCompletion(file.id);

    assert.strictEqual(res.statusCode, 401);
  });

  it("22. unknown file -> 404", async () => {
    sessionState.userId = "some-user";
    const res = await postCompletion("missing-file-id");
    assert.strictEqual(res.statusCode, 404);
  });

  it("23. PATCH method -> 405", async () => {
    const { team, user, file } = await setupFile({
      status: "READY_TO_CLOSE",
    });
    await addMember(team, user, "ADMIN");

    sessionState.userId = user.id;
    const res = mockRes();
    await completionHandler(
      mockReq({ method: "PATCH", query: { fileId: file.id } }),
      res,
    );

    assert.strictEqual(res.statusCode, 405);
  });
});
