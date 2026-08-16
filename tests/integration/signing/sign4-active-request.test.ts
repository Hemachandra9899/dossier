// SIGN.4 semantics integration tests.
//
// Covers the contract that drives the sender UI:
//  - the same recipient can receive unlimited requests across documents
//  - at most ONE non-terminal request per document (createDraft blocks)
//  - terminal statuses (FAILED/CANCELLED/DECLINED/EXPIRED/COMPLETED) never
//    block a new request and never surface as "active"
//  - getActiveRequest vs getLatestRequest divergence
//  - a retry after provider failure creates a brand-new request, not a zombie
//    of the FAILED one
//
// Run: TEST_DATABASE_URL="postgresql://..." npm run test:integration

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createDraft } from "@/features/signing/application/create-draft";
import { getActiveRequest, getLatestRequest } from "@/features/signing/application/get-active-request";
import {
  SigningProviderError,
  SigningStateError,
} from "@/features/signing/domain/signing-errors";

import {
  closeTestDatabase,
  resetTestDatabase,
  seedTeam,
  seedUser,
  seedVersionedDocument,
  testPrisma,
} from "../../helpers/test-db";
import { buildTestSigningContext } from "../../helpers/signing-fakes";

const SHARED_RECIPIENT_EMAIL = "same.recipient@example.com";

describe("SIGN.4 active-request semantics (integration)", () => {
  before(async () => {
    await resetTestDatabase();
  });

  after(async () => {
    await closeTestDatabase();
  });

  async function setup() {
    const ctx = buildTestSigningContext();
    const team = await seedTeam();
    const user = await seedUser();
    return { ctx, team, user };
  }

  async function makeDraft(ctx: ReturnType<typeof buildTestSigningContext>, teamId: string, documentId: string) {
    const { request } = await createDraft(ctx, {
      actor: { userId: "user-1", teamId },
      documentId,
      recipients: [{ email: SHARED_RECIPIENT_EMAIL, signingOrder: 1 }],
    });
    return request;
  }

  async function setTerminal(requestId: string, status: string) {
    await testPrisma.signatureRequest.update({
      where: { id: requestId },
      data: {
        status: status as never,
        ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
        ...(status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      },
    });
  }

  describe("recipient multiplicity", () => {
    it("the same recipient can appear on requests for different documents", async () => {
      const { ctx, team } = await setup();
      const docA = await seedVersionedDocument(team.id);
      const docB = await seedVersionedDocument(team.id);

      const reqA = await makeDraft(ctx, team.id, docA.id);
      const reqB = await makeDraft(ctx, team.id, docB.id);

      assert.equal(reqA.recipients[0].email, SHARED_RECIPIENT_EMAIL);
      assert.equal(reqB.recipients[0].email, SHARED_RECIPIENT_EMAIL);
      assert.notEqual(reqA.id, reqB.id);
      assert.equal(reqA.documentId, docA.id);
      assert.equal(reqB.documentId, docB.id);

      const rows = await testPrisma.signatureRecipient.findMany({
        where: { email: SHARED_RECIPIENT_EMAIL },
      });
      assert.equal(rows.length, 2);
    });

    it("one active request per document is enforced", async () => {
      const { ctx, team } = await setup();
      const document = await seedVersionedDocument(team.id);

      await makeDraft(ctx, team.id, document.id);

      await assert.rejects(
        createDraft(ctx, {
          actor: { userId: "user-1", teamId: team.id },
          documentId: document.id,
          recipients: [{ email: SHARED_RECIPIENT_EMAIL, signingOrder: 1 }],
        }),
        SigningStateError,
      );
    });
  });

  describe("terminal statuses never block a new request", () => {
    it("a FAILED request leaves the document open for a retry", async () => {
      const { ctx, team } = await setup();
      const document = await seedVersionedDocument(team.id);

      const provider = ctx.provider as any;
      const original = provider.createEnvelope.bind(provider);
      provider.createEnvelope = async () => {
        throw new Error("provider exploded");
      };

      await assert.rejects(
        createDraft(ctx, {
          actor: { userId: "user-1", teamId: team.id },
          documentId: document.id,
          recipients: [{ email: SHARED_RECIPIENT_EMAIL, signingOrder: 1 }],
        }),
        SigningProviderError,
      );

      const failed = await testPrisma.signatureRequest.findFirstOrThrow({
        where: { teamId: team.id, documentId: document.id, status: "FAILED" },
      });

      // Provider healthy again: a retry creates a brand-new request.
      provider.createEnvelope = original;
      const retry = await makeDraft(ctx, team.id, document.id);

      assert.notEqual(retry.id, failed.id);
      assert.equal(retry.status, "DRAFT");
      assert.notEqual(retry.providerEnvelopeId, failed.providerEnvelopeId);
    });

    it("a COMPLETED request never blocks a new request", async () => {
      const { ctx, team } = await setup();
      const document = await seedVersionedDocument(team.id);

      const req = await makeDraft(ctx, team.id, document.id);
      await setTerminal(req.id, "COMPLETED");

      const completed = await testPrisma.signatureRequest.findUniqueOrThrow({
        where: { id: req.id },
      });
      assert.equal(completed.status, "COMPLETED");

      const again = await makeDraft(ctx, team.id, document.id);
      assert.notEqual(again.id, req.id);
      assert.equal(again.status, "DRAFT");
    });

    it("a CANCELLED request never blocks a new request", async () => {
      const { ctx, team } = await setup();
      const document = await seedVersionedDocument(team.id);

      const req = await makeDraft(ctx, team.id, document.id);
      await setTerminal(req.id, "CANCELLED");

      const cancelled = await testPrisma.signatureRequest.findUniqueOrThrow({
        where: { id: req.id },
      });
      assert.equal(cancelled.status, "CANCELLED");

      const again = await makeDraft(ctx, team.id, document.id);
      assert.notEqual(again.id, req.id);
    });
  });

  describe("getActiveRequest vs getLatestRequest", () => {
    it("returns null for a document whose latest request is terminal", async () => {
      const { ctx, team } = await setup();
      const document = await seedVersionedDocument(team.id);

      const provider = ctx.provider as any;
      const original = provider.createEnvelope.bind(provider);
      provider.createEnvelope = async () => {
        throw new Error("provider exploded");
      };
      await assert.rejects(
        createDraft(ctx, {
          actor: { userId: "user-1", teamId: team.id },
          documentId: document.id,
          recipients: [{ email: SHARED_RECIPIENT_EMAIL, signingOrder: 1 }],
        }),
        SigningProviderError,
      );
      provider.createEnvelope = original;

      const active = await getActiveRequest(ctx, { teamId: team.id, documentId: document.id });
      assert.equal(active, null);

      const latest = await getLatestRequest(ctx, { teamId: team.id, documentId: document.id });
      assert.equal(latest?.status, "FAILED");
    });

    it("returns null after COMPLETED but the latest still resolves", async () => {
      const { ctx, team } = await setup();
      const document = await seedVersionedDocument(team.id);

      const req = await makeDraft(ctx, team.id, document.id);
      await setTerminal(req.id, "COMPLETED");

      const active = await getActiveRequest(ctx, { teamId: team.id, documentId: document.id });
      assert.equal(active, null);

      const latest = await getLatestRequest(ctx, { teamId: team.id, documentId: document.id });
      assert.equal(latest?.status, "COMPLETED");
    });

    it("returns the non-terminal request while one is in flight", async () => {
      const { ctx, team } = await setup();
      const document = await seedVersionedDocument(team.id);

      const req = await makeDraft(ctx, team.id, document.id);

      const active = await getActiveRequest(ctx, { teamId: team.id, documentId: document.id });
      assert.equal(active?.id, req.id);
      assert.equal(active?.status, "DRAFT");

      const latest = await getLatestRequest(ctx, { teamId: team.id, documentId: document.id });
      assert.equal(latest?.id, req.id);
    });

    it("tracks active + latest independently per document", async () => {
      const { ctx, team } = await setup();
      const docA = await seedVersionedDocument(team.id);
      const docB = await seedVersionedDocument(team.id);

      const reqA = await makeDraft(ctx, team.id, docA.id);
      await makeDraft(ctx, team.id, docB.id);

      const activeA = await getActiveRequest(ctx, { teamId: team.id, documentId: docA.id });
      const activeB = await getActiveRequest(ctx, { teamId: team.id, documentId: docB.id });

      assert.equal(activeA?.id, reqA.id);
      assert.notEqual(activeB?.id, reqA.id);
    });
  });

  describe("envelope isolation", () => {
    it("creates one fresh provider envelope per draft", async () => {
      const { ctx, team } = await setup();
      const document = await seedVersionedDocument(team.id);

      const req1 = await makeDraft(ctx, team.id, document.id);
      await setTerminal(req1.id, "CANCELLED");
      const req2 = await makeDraft(ctx, team.id, document.id);

      assert.notEqual(req1.providerEnvelopeId, req2.providerEnvelopeId);

      const rows = await testPrisma.signatureRequest.findMany({
        where: { teamId: team.id, documentId: document.id },
        orderBy: { createdAt: "asc" },
      });
      assert.equal(rows.length, 2);
      const envelopeIds = rows.map((r) => r.providerEnvelopeId);
      assert.equal(new Set(envelopeIds).size, 2);
    });
  });
});
