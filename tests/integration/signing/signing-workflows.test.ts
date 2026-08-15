// Signing workflow integration tests. Exercises the full request lifecycle
// against a real Postgres test database with in-memory fakes for the signing
// provider, artifact storage, mirror handoff and file fetcher.
//
// Run: TEST_DATABASE_URL="postgresql://..." npm run test:integration

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import crypto from "crypto";

import { cancelRequest } from "@/features/signing/application/cancel-request";
import { createEditorSession } from "@/features/signing/application/create-editor-session";
import { createRequest } from "@/features/signing/application/create-request";
import { createSigningSession } from "@/features/signing/application/create-signing-session";
import { createTemplate } from "@/features/signing/application/create-template";
import { exchangeRecipientAccessToken } from "@/features/signing/application/exchange-recipient-access-token";
import { getPublicRequest } from "@/features/signing/application/get-public-request";
import { getPublicSignedArtifact } from "@/features/signing/application/get-public-signed-artifact";
import { getRecipientAccessToken } from "@/features/signing/application/get-recipient-access-token";
import { getRequest } from "@/features/signing/application/get-request";
import { getSignedArtifact } from "@/features/signing/application/get-signed-artifact";
import { mirrorSignedArtifact } from "@/features/signing/application/mirror-signed-artifact";
import { processProviderEvent } from "@/features/signing/application/process-provider-event";
import {
  SigningNotFoundError,
  SigningProviderError,
  SigningStateError,
  SigningValidationError,
} from "@/features/signing/domain/signing-errors";

import {
  closeTestDatabase,
  resetTestDatabase,
  seedDocument,
  seedTeam,
  seedUser,
  testPrisma,
} from "../../helpers/test-db";
import {
  FakeArtifactStorage,
  FakeMirrorHandoff,
  FakeSigningProvider,
  SIGNED_PDF_BYTES,
  buildTestSigningContext,
  stopSignedPdfServer,
} from "../../helpers/signing-fakes";
async function setupTemplate() {
  const ctx = buildTestSigningContext({ runMirrorInline: true });
  const team = await seedTeam();
  const user = await seedUser();
  const document = await seedDocument(team.id);

  const { template } = await createTemplate(ctx, {
    actor: { userId: user.id, teamId: team.id },
    documentId: document.id,
    name: "Master Service Agreement",
  });

  return { ctx, team, user, document, template };
}

async function setupRequest(overrides: { expiresAt?: string } = {}) {
  const base = await setupTemplate();
  const { requestId } = await createRequest(base.ctx, {
    actor: { userId: base.user.id, teamId: base.team.id },
    documentId: base.document.id,
    templateId: base.template.id,
    recipients: [
      {
        name: "Alice Example",
        email: "alice@example.com",
        signingOrder: 1,
      },
    ],
    expiresAt: overrides.expiresAt ?? null,
    skipAutoDelivery: true,
  });
  return { ...base, requestId };
}

async function happyPathEvents(
  ctx: ReturnType<typeof buildTestSigningContext>,
  externalId: string,
) {
  await processProviderEvent(ctx, { event: "DOCUMENT_SIGNED", externalId });
  await processProviderEvent(ctx, { event: "DOCUMENT_COMPLETED", externalId });
}

describe("signing workflows (integration)", () => {
  before(async () => {
    await resetTestDatabase();
  });

  after(async () => {
    await stopSignedPdfServer();
    await closeTestDatabase();
  });

  describe("template lifecycle", () => {
    it("creates a template and makes it READY with provider ids", async () => {
      const { ctx, template } = await setupTemplate();
      assert.equal(template.status, "READY");
      assert.ok(template.providerTemplateId);
      assert.ok(template.providerEnvelopeId);
      assert.ok(template.providerExternalId.startsWith("dossier:team:"));
      assert.equal((ctx.provider as FakeSigningProvider).createTemplateCalls, 1);
    });

    it("rejects a document from another team", async () => {
      const ctx = buildTestSigningContext();
      const team = await seedTeam();
      const otherTeam = await seedTeam();
      const user = await seedUser();
      const otherDocument = await seedDocument(otherTeam.id);

      await assert.rejects(
        createTemplate(ctx, {
          actor: { userId: user.id, teamId: team.id },
          documentId: otherDocument.id,
          name: "Cross Team Doc",
        }),
        SigningNotFoundError,
      );
    });

    it("keeps the template FAILED when the provider create call fails", async () => {
      const ctx = buildTestSigningContext();
      const team = await seedTeam();
      const user = await seedUser();
      const document = await seedDocument(team.id);
      (ctx.provider as FakeSigningProvider).failCreateTemplate = true;

      await assert.rejects(
        createTemplate(ctx, {
          actor: { userId: user.id, teamId: team.id },
          documentId: document.id,
          name: "Failing Template",
        }),
        SigningProviderError,
      );

      const row = await testPrisma.signatureTemplate.findFirstOrThrow({
        where: { teamId: team.id },
      });
      assert.equal(row.status, "FAILED");
    });

    it("authorizes an editor session for a READY template", async () => {
      const { ctx, team, template } = await setupTemplate();
      const session = await createEditorSession(ctx, {
        teamId: team.id,
        templateId: template.id,
      });
      assert.equal(session.templateId, template.id);
      assert.equal(session.provider, "DOCUMENSO");
      assert.ok(session.presignToken);
    });
  });

  describe("request creation", () => {
    it("creates a READY request with normalized recipients", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const dto = await getRequest(ctx, { teamId: team.id, requestId });

      assert.equal(dto.status, "READY");
      assert.equal(dto.recipients.length, 1);
      assert.equal(dto.recipients[0].email, "alice@example.com");
      assert.ok(dto.providerEnvelopeId);
      assert.ok(dto.providerExternalId.startsWith("dossier:team:"));
      assert.equal((ctx.provider as FakeSigningProvider).createSigningDocumentCalls, 1);
    });

    it("rejects a template that does not belong to the document", async () => {
      const { ctx, team, user, document, template } = await setupTemplate();
      const otherDocument = await seedDocument(team.id);

      await assert.rejects(
        createRequest(ctx, {
          actor: { userId: user.id, teamId: team.id },
          documentId: otherDocument.id,
          templateId: template.id,
          recipients: [{ email: "alice@example.com" }],
        }),
        SigningValidationError,
      );
    });

    it("rejects duplicate recipient emails", async () => {
      const { ctx, team, user, document, template } = await setupTemplate();
      await assert.rejects(
        createRequest(ctx, {
          actor: { userId: user.id, teamId: team.id },
          documentId: document.id,
          templateId: template.id,
          recipients: [
            { email: "A@example.com" },
            { email: "a@EXAMPLE.com" },
          ],
        }),
        SigningValidationError,
      );
    });

    it("keeps the request FAILED when the provider call fails", async () => {
      const ctx = buildTestSigningContext();
      const team = await seedTeam();
      const user = await seedUser();
      const document = await seedDocument(team.id);
      const { template } = await createTemplate(ctx, {
        actor: { userId: user.id, teamId: team.id },
        documentId: document.id,
        name: "Template For Failure",
      });
      (ctx.provider as FakeSigningProvider).failCreateSigningDocument = true;

      await assert.rejects(
        createRequest(ctx, {
          actor: { userId: user.id, teamId: team.id },
          documentId: document.id,
          templateId: template.id,
          recipients: [{ email: "alice@example.com" }],
        }),
        SigningProviderError,
      );

      const row = await testPrisma.signatureRequest.findFirstOrThrow({
        where: { teamId: team.id },
      });
      assert.equal(row.status, "FAILED");
    });
  });

  describe("provider events", () => {
    it("drives the request through SIGNING -> PARTIALLY_SIGNED -> COMPLETED", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const before = await getRequest(ctx, { teamId: team.id, requestId });

      const dto = await processProviderEvent(ctx, {
        event: "DOCUMENT_SIGNED",
        externalId: before.providerExternalId,
      });
      assert.equal(dto.status, "PARTIALLY_SIGNED");

      const completed = await processProviderEvent(ctx, {
        event: "DOCUMENT_COMPLETED",
        externalId: before.providerExternalId,
      });
      assert.equal(completed.status, "COMPLETED");
      assert.ok(completed.completedAt);
    });

    it("ignores duplicate intermediate events", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const before = await getRequest(ctx, { teamId: team.id, requestId });
      await processProviderEvent(ctx, {
        event: "DOCUMENT_SIGNED",
        externalId: before.providerExternalId,
      });
      const after = await processProviderEvent(ctx, {
        event: "DOCUMENT_SIGNED",
        externalId: before.providerExternalId,
      });
      assert.equal(after.status, "PARTIALLY_SIGNED");
    });

    it("rejects out-of-order events that would skip states", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const before = await getRequest(ctx, { teamId: team.id, requestId });

      await assert.rejects(
        processProviderEvent(ctx, {
          event: "DOCUMENT_COMPLETED",
          externalId: before.providerExternalId,
        }),
        SigningStateError,
      );
    });

    it("applies DECLINED and CANCELLED terminal events", async () => {
      const declined = await setupRequest();
      const declinedBefore = await getRequest(declined.ctx, {
        teamId: declined.team.id,
        requestId: declined.requestId,
      });
      const declinedDto = await processProviderEvent(declined.ctx, {
        event: "DOCUMENT_REJECTED",
        externalId: declinedBefore.providerExternalId,
      });
      assert.equal(declinedDto.status, "DECLINED");

      const cancelled = await setupRequest();
      const cancelledBefore = await getRequest(cancelled.ctx, {
        teamId: cancelled.team.id,
        requestId: cancelled.requestId,
      });
      const cancelledDto = await processProviderEvent(cancelled.ctx, {
        event: "DOCUMENT_CANCELLED",
        externalId: cancelledBefore.providerExternalId,
      });
      assert.equal(cancelledDto.status, "CANCELLED");
    });

    it("handles stray events on a terminal request without changing state", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const before = await getRequest(ctx, { teamId: team.id, requestId });
      await happyPathEvents(ctx, before.providerExternalId);

      const stray = await processProviderEvent(ctx, {
        event: "DOCUMENT_SIGNED",
        externalId: before.providerExternalId,
      });
      assert.equal(stray.status, "COMPLETED");
    });
  });

  describe("recipient signing sessions", () => {
    it("opens a session for a matching recipient", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const before = await getRequest(ctx, { teamId: team.id, requestId });
      const recipientId = before.recipients[0].id;

      const session = await createSigningSession(ctx, {
        requestId,
        recipientId,
        email: "alice@example.com",
      });

      assert.equal(session.provider, "DOCUMENSO");
      assert.equal(session.requestId, requestId);
      assert.equal(session.recipientId, recipientId);
      assert.ok(session.token);

      const after = await getRequest(ctx, { teamId: team.id, requestId });
      assert.equal(after.status, "SIGNING");
      assert.equal(after.recipients[0].status, "SIGNING");
    });

    it("rejects a mismatched recipient identity", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const before = await getRequest(ctx, { teamId: team.id, requestId });

      await assert.rejects(
        createSigningSession(ctx, {
          requestId,
          recipientId: before.recipients[0].id,
          email: "mallory@example.com",
        }),
        SigningValidationError,
      );
    });

    it("rejects sessions on an expired request", async () => {
      const { ctx, requestId, team } = await setupRequest({
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      });
      const before = await getRequest(ctx, { teamId: team.id, requestId });

      await assert.rejects(
        createSigningSession(ctx, {
          requestId,
          recipientId: before.recipients[0].id,
          email: "alice@example.com",
        }),
        SigningStateError,
      );

      const after = await getRequest(ctx, { teamId: team.id, requestId });
      assert.equal(after.status, "EXPIRED");
    });

    it("rejects sessions on a cancelled request", async () => {
      const { ctx, requestId, team } = await setupRequest();
      await cancelRequest(ctx, { teamId: team.id, requestId });
      const before = await getRequest(ctx, { teamId: team.id, requestId });

      await assert.rejects(
        createSigningSession(ctx, {
          requestId,
          recipientId: before.recipients[0].id,
          email: "alice@example.com",
        }),
        SigningStateError,
      );
    });

    it("rejects sessions on a completed request", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const before = await getRequest(ctx, { teamId: team.id, requestId });
      await happyPathEvents(ctx, before.providerExternalId);

      await assert.rejects(
        createSigningSession(ctx, {
          requestId,
          recipientId: before.recipients[0].id,
          email: "alice@example.com",
        }),
        SigningStateError,
      );
    });
  });

  describe("signed artifact mirroring", () => {
    it("mirrors the signed artifact on COMPLETED and serves it", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const before = await getRequest(ctx, { teamId: team.id, requestId });
      await happyPathEvents(ctx, before.providerExternalId);

      const artifact = await getSignedArtifact(ctx, {
        teamId: team.id,
        requestId,
      });
      assert.equal(artifact.status, "completed");
      assert.equal(
        artifact.artifact!.fileName,
        "contract-pdf_signed.pdf",
      );
      assert.equal(
        artifact.artifact!.sha256,
        crypto.createHash("sha256").update(SIGNED_PDF_BYTES).digest("hex"),
      );
      assert.equal(artifact.artifact!.sizeBytes, String(SIGNED_PDF_BYTES.byteLength));

      const mirror = ctx.artifactMirror as FakeMirrorHandoff;
      assert.deepEqual(mirror.enqueued, [requestId]);
      assert.equal((ctx.storage as FakeArtifactStorage).uploads.length, 1);
    });

    it("is idempotent on retry (no double upload)", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const before = await getRequest(ctx, { teamId: team.id, requestId });
      await happyPathEvents(ctx, before.providerExternalId);

      const retried = await mirrorSignedArtifact(ctx, { requestId });
      assert.deepEqual(retried, { mirrored: false, reason: "already-mirrored" });
      assert.equal((ctx.storage as FakeArtifactStorage).uploads.length, 1);
    });

    it("refuses to mirror a request that is not completed", async () => {
      const { ctx, requestId } = await setupRequest();
      const result = await mirrorSignedArtifact(ctx, { requestId });
      assert.deepEqual(result, { mirrored: false, reason: "not-completed" });
    });

    it("treats the artifact row as immutable", async () => {
      const { ctx, requestId, team } = await setupRequest();
      const before = await getRequest(ctx, { teamId: team.id, requestId });
      await happyPathEvents(ctx, before.providerExternalId);

      await assert.rejects(
        ctx.requests.createArtifact({
          signatureRequestId: requestId,
          storageKey: "s3://another-key.pdf",
          fileName: "another.pdf",
          mimeType: "application/pdf",
          sha256: "deadbeef",
          sizeBytes: BigInt(1),
        }),
        (error: unknown) =>
          typeof error === "object" &&
          error !== null &&
          (error as { code?: string }).code === "P2002",
      );
    });
  });

  describe("team scoping", () => {
    it("hides requests from other teams", async () => {
      const { ctx, requestId } = await setupRequest();
      const otherTeam = await seedTeam();

      await assert.rejects(
        getRequest(ctx, { teamId: otherTeam.id, requestId }),
        SigningNotFoundError,
      );
      await assert.rejects(
        cancelRequest(ctx, { teamId: otherTeam.id, requestId }),
        SigningNotFoundError,
      );
      await assert.rejects(
        getSignedArtifact(ctx, { teamId: otherTeam.id, requestId }),
        SigningNotFoundError,
      );
    });

    it("cancel is idempotent for an already-cancelled request", async () => {
      const { ctx, requestId, team } = await setupRequest();
      await cancelRequest(ctx, { teamId: team.id, requestId });
      const again = await cancelRequest(ctx, { teamId: team.id, requestId });
      assert.equal(again.status, "CANCELLED");
    });
  });

  describe("recipient access", () => {
    let secret: string | undefined;
    let team: Awaited<ReturnType<typeof seedTeam>>;
    let user: Awaited<ReturnType<typeof seedUser>>;

    before(async () => {
      secret = process.env.NEXT_PRIVATE_VERIFICATION_SECRET;
      process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "integration-test-secret";
      team = await seedTeam();
      user = await seedUser();
    });

    after(async () => {
      if (secret === undefined) {
        delete process.env.NEXT_PRIVATE_VERIFICATION_SECRET;
      } else {
        process.env.NEXT_PRIVATE_VERIFICATION_SECRET = secret;
      }
    });

    async function setupRecipientRequest(overrides: { expiresAt?: string } = {}) {
      const ctx = buildTestSigningContext();
      const document = await seedDocument(team.id);
      const { template } = await createTemplate(ctx, {
        actor: { userId: user.id, teamId: team.id },
        documentId: document.id,
        name: "Master Service Agreement",
      });
      const { requestId } = await createRequest(ctx, {
        actor: { userId: user.id, teamId: team.id },
        documentId: document.id,
        templateId: template.id,
        recipients: [
          { name: "Alice Example", email: "alice@example.com", signingOrder: 1 },
        ],
        expiresAt: overrides.expiresAt ?? null,
        skipAutoDelivery: true,
      });
      const before = await getRequest(ctx, { teamId: team.id, requestId });
      return { ctx, team, requestId, recipientId: before.recipients[0].id };
    }

    async function recipientHappyPath(
      ctx: ReturnType<typeof buildTestSigningContext>,
      requestId: string,
    ) {
      const before = await getRequest(ctx, { teamId: team.id, requestId });
      await processProviderEvent(ctx, {
        event: "DOCUMENT_SIGNED",
        externalId: before.providerExternalId,
      });
      await processProviderEvent(ctx, {
        event: "DOCUMENT_COMPLETED",
        externalId: before.providerExternalId,
      });
    }

    describe("getPublicRequest", () => {
      it("returns the minimal recipient-safe DTO for a verified recipient", async () => {
        const { ctx, requestId, recipientId } = await setupRecipientRequest();

        const dto = await getPublicRequest(ctx, { requestId, recipientId });

        assert.equal(dto.id, requestId);
        assert.equal(dto.document.name, "Contract.pdf");
        assert.equal(dto.recipient.name, "Alice Example");
        assert.equal(dto.status, "READY");
        assert.equal(dto.canSign, true);
        assert.equal(dto.canDownloadSignedCopy, false);
        assert.equal(dto.expiresAt, null);
      });

      it("hides requests that never reached a recipient-visible state", async () => {
        const ctx = buildTestSigningContext();
        const document = await seedDocument(team.id);
        const { template } = await createTemplate(ctx, {
          actor: { userId: user.id, teamId: team.id },
          documentId: document.id,
          name: "Failure Template",
        });
        (ctx.provider as FakeSigningProvider).failCreateSigningDocument = true;

        await assert.rejects(
          createRequest(ctx, {
            actor: { userId: user.id, teamId: team.id },
            documentId: document.id,
            templateId: template.id,
            recipients: [{ email: "alice@example.com" }],
          }),
          SigningProviderError,
        );

        const row = await testPrisma.signatureRequest.findFirstOrThrow({
          where: { teamId: team.id, status: "FAILED" },
        });
        assert.equal(row.status, "FAILED");

        await assert.rejects(
          getPublicRequest(ctx, { requestId: row.id, recipientId: "any" }),
          SigningNotFoundError,
        );
      });

      it("never reveals a request to a recipient not on it", async () => {
        const { ctx, requestId } = await setupRecipientRequest();

        await assert.rejects(
          getPublicRequest(ctx, {
            requestId,
            recipientId: "rec_not_on_request",
          }),
          SigningNotFoundError,
        );
      });

      it("marks an expired-but-not-terminal request as not signable", async () => {
        const { ctx, requestId, recipientId } = await setupRecipientRequest({
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        });

        const dto = await getPublicRequest(ctx, { requestId, recipientId });

        assert.equal(dto.status, "READY");
        assert.equal(dto.canSign, false);
        assert.ok(dto.expiresAt);
      });

      it("unlocks the signed copy on completion", async () => {
        const { ctx, requestId, recipientId } = await setupRecipientRequest();
        await recipientHappyPath(ctx, requestId);

        const dto = await getPublicRequest(ctx, { requestId, recipientId });

        assert.equal(dto.status, "COMPLETED");
        assert.equal(dto.canSign, false);
        assert.equal(dto.canDownloadSignedCopy, true);
        assert.ok(dto.completedAt);
      });
    });

    describe("getPublicSignedArtifact", () => {
      it("rejects access before completion", async () => {
        const { ctx, requestId, recipientId } = await setupRecipientRequest();

        await assert.rejects(
          getPublicSignedArtifact(ctx, { requestId, recipientId }),
          SigningStateError,
        );
      });

      it("returns pending when the mirror has not landed yet", async () => {
        const { ctx, requestId, recipientId } = await setupRecipientRequest();
        await recipientHappyPath(ctx, requestId);

        const dto = await getPublicSignedArtifact(ctx, { requestId, recipientId });
        assert.deepEqual(dto, { status: "pending" });
      });

      it("never reveals an artifact to a recipient not on the request", async () => {
        const { ctx, requestId } = await setupRecipientRequest();

        await assert.rejects(
          getPublicSignedArtifact(ctx, {
            requestId,
            recipientId: "rec_not_on_request",
          }),
          SigningNotFoundError,
        );
      });
    });

    describe("getRecipientAccessToken (sender mint)", () => {
      it("mints a token capped by the request expiry", async () => {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const { ctx, team, requestId, recipientId } = await setupRecipientRequest({
          expiresAt: expiresAt.toISOString(),
        });

        const access = await getRecipientAccessToken(ctx, {
          teamId: team.id,
          requestId,
          recipientId,
        });

        assert.equal(access.recipientId, recipientId);
        assert.equal(new Date(access.expiresAt).getTime(), expiresAt.getTime());
        assert.ok(access.token);
      });

      it("is team-scoped: another team cannot mint a link", async () => {
        const { ctx, requestId, recipientId } = await setupRecipientRequest();
        const otherTeam = await seedTeam();

        await assert.rejects(
          getRecipientAccessToken(ctx, {
            teamId: otherTeam.id,
            requestId,
            recipientId,
          }),
          SigningNotFoundError,
        );
      });

      it("rejects a recipient that is not on the request", async () => {
        const { ctx, requestId } = await setupRecipientRequest();

        await assert.rejects(
          getRecipientAccessToken(ctx, {
            teamId: team.id,
            requestId,
            recipientId: "rec_not_on_request",
          }),
          SigningNotFoundError,
        );
      });
    });

    describe("exchangeRecipientAccessToken", () => {
      it("exchanges a valid invitation token for the bound recipient", async () => {
        const { ctx, requestId, recipientId } = await setupRecipientRequest();
        const access = await getRecipientAccessToken(ctx, {
          teamId: team.id,
          requestId,
          recipientId,
        });

        const result = await exchangeRecipientAccessToken(ctx, {
          requestId,
          token: access.token,
        });

        assert.equal(result.ok, true);
        assert.equal(result.recipientId, recipientId);
      });

      it("rejects a token minted for a different request", async () => {
        const { ctx, requestId } = await setupRecipientRequest();
        const other = await setupRecipientRequest();
        const access = await getRecipientAccessToken(other.ctx, {
          teamId: other.team.id,
          requestId: other.requestId,
          recipientId: other.recipientId,
        });

        await assert.rejects(
          exchangeRecipientAccessToken(ctx, { requestId, token: access.token }),
          SigningValidationError,
        );
      });

      it("rejects a token whose request has expired", async () => {
        const expired = await setupRecipientRequest({
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        });
        const access = await getRecipientAccessToken(expired.ctx, {
          teamId: expired.team.id,
          requestId: expired.requestId,
          recipientId: expired.recipientId,
        });

        await assert.rejects(
          exchangeRecipientAccessToken(expired.ctx, {
            requestId: expired.requestId,
            token: access.token,
          }),
          SigningValidationError,
        );
      });
    });
  });
});
