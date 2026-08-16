// Shared test database helper. Runs integration tests against a dedicated test
// database (TEST_DATABASE_URL) so the dev/prod database is never touched.
//
//   TEST_DATABASE_URL="postgresql://..." npm run test:integration

import assert from "node:assert/strict";

import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (!TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required to run integration tests. See tests/integration/README.md",
  );
}

const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });

/**
 * Drops every row in the test database before each test file runs.
 * The truncate runs in a single statement across ~95 tables, so it needs a
 * generous interactive-transaction timeout (default 5s is too short).
 */
export async function resetTestDatabase(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const result = await tx.$queryRawUnsafe<Array<{ tablename: string }>>(
        `SELECT tablename
           FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename <> '_prisma_migrations'`,
      );
      const tables = result.map(({ tablename }) => `"${tablename}"`);
      if (tables.length > 0) {
        await tx.$executeRawUnsafe(
          `TRUNCATE TABLE ${tables.join(", ")} CASCADE`,
        );
      }
    },
    { timeout: 60_000 },
  );
}

export async function closeTestDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export function seedTeam(overrides: Partial<{ name: string }> = {}) {
  return prisma.team.create({
    data: { name: overrides.name ?? "Test Team" },
  });
}

export function seedUser(overrides: Partial<{ name: string; email: string }> = {}) {
  return prisma.user.create({
    data: {
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `user_${Date.now()}@example.com`,
    },
  });
}

export function seedDocument(
  teamId: string,
  overrides: Partial<{
    name: string;
    file: string;
    contentType: string;
    storageType: string;
  }> = {},
) {
  return prisma.document.create({
    data: {
      teamId,
      name: overrides.name ?? "Contract.pdf",
      file: overrides.file ?? "s3://test/contract.pdf",
      contentType: overrides.contentType ?? "application/pdf",
      storageType: (overrides.storageType ?? "S3_PATH") as never,
    },
  });
}

/**
 * Seeds a document with a primary version, matching how a real upload persists
 * its file on a DocumentVersion. The signing application reads the signable
 * file bytes from the primary version, so tests exercising createTemplate /
 * createDraft must seed a version.
 */
export async function seedVersionedDocument(
  teamId: string,
  overrides: Partial<{
    name: string;
    file: string;
    contentType: string;
    storageType: string;
  }> = {},
) {
  const document = await seedDocument(teamId, overrides);
  await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber: 1,
      file: overrides.file ?? "s3://test/contract.pdf",
      contentType: overrides.contentType ?? "application/pdf",
      isPrimary: true,
      storageType: (overrides.storageType ?? "S3_PATH") as never,
    },
  });
  return document;
}

export function assertTestDatabaseReachable() {
  return prisma.$queryRaw`SELECT 1`;
}

export { prisma as testPrisma };
