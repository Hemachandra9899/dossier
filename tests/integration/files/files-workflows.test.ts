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
import { syncDossierFileStatus } from "@/modules/files/application/sync-file-status";
import { getFilesBoard } from "@/modules/files/application/get-files-board";
import { DossierFileStatus } from "@prisma/client";

describe("files workspace workflows (integration)", () => {
  before(async () => {
    await resetTestDatabase();
  });

  after(async () => {
    await closeTestDatabase();
  });

  it("creates a dossier file transactionally", async () => {
    const team = await seedTeam();
    const user = await seedUser({ email: `user-${crypto.randomUUID()}@example.com` });

    const file = await createDossierFile({
      teamId: team.id,
      userId: user.id,
      title: "Mortgage Pre-approval Case",
      clientName: "John Smith",
      clientEmail: "john@example.com",
    });

    assert.strictEqual(file.title, "Mortgage Pre-approval Case");
    assert.strictEqual(file.status, "NEW");

    // Verify backing Dataroom and TaskList were created
    const dataroom = await testPrisma.dataroom.findUnique({
      where: { id: file.dataroomId },
    });
    assert.ok(dataroom);
    assert.strictEqual(dataroom.requestListEnabled, true);

    const taskList = await testPrisma.taskList.findUnique({
      where: { id: file.requirementsTaskListId! },
    });
    assert.ok(taskList);
    assert.strictEqual(taskList.name, "Required Documents");

    // Verify timeline activity
    const activities = await testPrisma.dossierFileActivity.findMany({
      where: { fileId: file.id },
    });
    assert.strictEqual(activities.length, 1);
    assert.strictEqual(activities[0].type, "FILE_CREATED");
  });

  it("filters board access based on DATAROOM_MEMBER assignments", async () => {
    const team = await seedTeam();
    const user = await seedUser({ email: `user-${crypto.randomUUID()}@example.com` });
    const scopedUser = await seedUser({ email: `scoped-${crypto.randomUUID()}@example.com` });

    // Map scopedUser to the team as DATAROOM_MEMBER
    await testPrisma.userTeam.create({
      data: {
        teamId: team.id,
        userId: scopedUser.id,
        role: "DATAROOM_MEMBER",
      },
    });

    const file1 = await createDossierFile({
      teamId: team.id,
      userId: user.id,
      title: "Client File A",
    });
    const file2 = await createDossierFile({
      teamId: team.id,
      userId: user.id,
      title: "Client File B",
    });

    // Assign scopedUser to Dataroom for File A only
    await testPrisma.userDataroom.create({
      data: {
        userId: scopedUser.id,
        teamId: team.id,
        dataroomId: file1.dataroomId,
      },
    });

    // Manager / Admin views the board -> sees both files
    const allCards = await getFilesBoard({
      teamId: team.id,
      userId: user.id,
      role: "ADMIN",
    });
    assert.strictEqual(allCards.length, 2);

    // Scoped member views the board -> sees only File A
    const scopedCards = await getFilesBoard({
      teamId: team.id,
      userId: scopedUser.id,
      role: "DATAROOM_MEMBER",
    });
    assert.strictEqual(scopedCards.length, 1);
    assert.strictEqual(scopedCards[0].id, file1.id);
  });

  it("syncs file status based on requirements checklist transitions", async () => {
    const team = await seedTeam();
    const user = await seedUser({ email: `user-${crypto.randomUUID()}@example.com` });

    const file = await createDossierFile({
      teamId: team.id,
      userId: user.id,
      title: "Case file checklist",
    });

    // Add a requirement task
    const task = await testPrisma.task.create({
      data: {
        taskListId: file.requirementsTaskListId!,
        dataroomId: file.dataroomId,
        teamId: team.id,
        title: "Tax Return Doc",
        type: "UPLOAD",
        status: "OPEN",
        createdByUserId: user.id,
      },
    });

    // Status sync -> COLLECTING
    let synced = await syncDossierFileStatus(file.id);
    assert.strictEqual(synced?.status, DossierFileStatus.COLLECTING);

    // Make it assigned to a client email -> WAITING_ON_CLIENT
    await testPrisma.taskAssignment.create({
      data: {
        taskId: task.id,
        email: "client@example.com",
      },
    });

    synced = await syncDossierFileStatus(file.id);
    assert.strictEqual(synced?.status, DossierFileStatus.WAITING_ON_CLIENT);

    // Submit requirement -> REVIEWING
    await testPrisma.task.update({
      where: { id: task.id },
      data: { status: "SUBMITTED" },
    });

    synced = await syncDossierFileStatus(file.id);
    assert.strictEqual(synced?.status, DossierFileStatus.REVIEWING);

    // Complete requirement -> READY_TO_CLOSE (requiresSignature is false)
    await testPrisma.task.update({
      where: { id: task.id },
      data: { status: "COMPLETED" },
    });

    synced = await syncDossierFileStatus(file.id);
    assert.strictEqual(synced?.status, DossierFileStatus.READY_TO_CLOSE);

    // READY_TO_CLOSE never sets completedAt and never emits FILE_COMPLETED
    assert.strictEqual(synced?.completedAt, null);

    const activities = await testPrisma.dossierFileActivity.findMany({
      where: { fileId: file.id },
      orderBy: { occurredAt: "asc" },
    });

    const types = activities.map((a) => a.type);
    assert.ok(types.includes("STATUS_CHANGED"));
    assert.ok(!types.includes("FILE_COMPLETED"));

    const lastStatusChange = [...activities]
      .reverse()
      .find((a) => a.type === "STATUS_CHANGED");
    assert.strictEqual(
      (lastStatusChange?.metadata as { to?: string } | null)?.to,
      "READY_TO_CLOSE",
    );
  });

  it("provisions file checklist from a template and auto-assigns tasks", async () => {
    const team = await seedTeam();
    const user = await seedUser({ email: `user-${crypto.randomUUID()}@example.com` });

    // Seed a mock template
    const template = await testPrisma.dossierFileTemplate.create({
      data: {
        key: `test-mortgage-app-${crypto.randomUUID()}`,
        name: "Test Mortgage Application",
        isGlobal: true,
        requirements: {
          create: [
            { title: "Bank Statements", type: "UPLOAD" },
            { title: "ID Copy", type: "UPLOAD" },
          ],
        },
      },
    });

    const file = await createDossierFile({
      teamId: team.id,
      userId: user.id,
      title: "Mortgage file with template",
      clientEmail: "client-test@example.com",
      templateId: template.id,
    });

    // Check that the tasks are created and assigned to the client
    const tasks = await testPrisma.task.findMany({
      where: { taskListId: file.requirementsTaskListId! },
      include: { assignments: true },
    });

    assert.strictEqual(tasks.length, 2);
    assert.ok(tasks.some((t) => t.title === "Bank Statements"));
    assert.ok(tasks.some((t) => t.title === "ID Copy"));

    for (const t of tasks) {
      assert.strictEqual(t.assignments.length, 1);
      assert.strictEqual(t.assignments[0].email, "client-test@example.com");
    }

    // Verify derived status is WAITING_ON_CLIENT because of assignments
    assert.strictEqual(file.status, DossierFileStatus.WAITING_ON_CLIENT);
  });
});
