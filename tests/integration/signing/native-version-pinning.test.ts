// SIGN.NATIVE.1 version-pinning integration tests.
//
// The native contract says a request pins the exact document version being
// signed and the SHA-256 of the source PDF, so a newer upload never silently
// changes the PDF the signer sees.
//
// Run: TEST_DATABASE_URL="postgresql://..." npm run test:integration

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { createDraft } from "@/features/signing/application/create-draft";

import {
  closeTestDatabase,
  resetTestDatabase,
  seedTeam,
  seedUser,
  seedVersionedDocument,
  testPrisma,
} from "../../helpers/test-db";
import { buildTestSigningContext } from "../../helpers/signing-fakes";

const SOURCE_BYTES = Buffer.from("%PDF");

describe("SIGN.NATIVE.1 version pinning (integration)", () => {
  before(async () => {
    await resetTestDatabase();
  });

  after(async () => {
    await closeTestDatabase();
  });

  it("pins the primary document version and its source sha256 on draft create", async () => {
    const ctx = buildTestSigningContext();
    const team = await seedTeam();
    const user = await seedUser();
    const document = await seedVersionedDocument(team.id);

    const { request } = await createDraft(ctx, {
      actor: { userId: user.id, teamId: team.id },
      documentId: document.id,
      recipients: [{ email: "pin-test@example.com", signingOrder: 1 }],
    });

    const row = await testPrisma.signatureRequest.findUnique({
      where: { id: request.id },
      include: {
        documentVersion: true,
      },
    });

    assert.ok(row);
    assert.ok(row.documentVersionId, "documentVersionId must be pinned");

    const version = await testPrisma.documentVersion.findFirst({
      where: { documentId: document.id, isPrimary: true },
    });
    assert.ok(version);
    assert.equal(row.documentVersionId, version.id);
    assert.equal(
      row.sourceSha256,
      createHash("sha256").update(SOURCE_BYTES).digest("hex"),
    );
    assert.equal(row.documentVersion?.id, version.id);
  });

  it("keeps the pinned version even when a newer version is uploaded", async () => {
    const ctx = buildTestSigningContext();
    const team = await seedTeam();
    const user = await seedUser();
    const document = await seedVersionedDocument(team.id);

    const { request } = await createDraft(ctx, {
      actor: { userId: user.id, teamId: team.id },
      documentId: document.id,
      recipients: [{ email: "pin-keep@example.com", signingOrder: 1 }],
    });

    // A new primary version arrives after the request was created.
    await testPrisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 2,
        file: "s3://test/contract-v2.pdf",
        contentType: "application/pdf",
        isPrimary: true,
        storageType: "S3_PATH",
      },
    });

    const row = await testPrisma.signatureRequest.findUnique({
      where: { id: request.id },
    });

    const originalVersion = await testPrisma.documentVersion.findFirst({
      where: { documentId: document.id, versionNumber: 1 },
    });
    assert.ok(originalVersion);
    assert.equal(row?.documentVersionId, originalVersion.id);
    assert.notEqual(row?.documentVersionId, (await testPrisma.documentVersion.findFirst({
      where: { documentId: document.id, isPrimary: true },
    }))?.id);
  });
});