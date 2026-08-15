import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  buildRecipientAccessCookieHeader,
  computeRecipientAccessExpiry,
  mintRecipientAccessToken,
  parseRecipientAccessToken,
  readRecipientAccessFromCookies,
  recipientAccessCookieName,
  RECIPIENT_ACCESS_TOKEN_TTL_MS,
  verifyRecipientAccessToken,
} from "@/features/signing/domain/recipient-access-token";

const originalSecret = process.env.NEXT_PRIVATE_VERIFICATION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.NEXT_PRIVATE_VERIFICATION_SECRET;
  } else {
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = originalSecret;
  }
});

function mint(input: {
  requestId?: string;
  recipientId?: string;
  expiresAt?: Date;
} = {}) {
  process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "test-secret";
  return mintRecipientAccessToken({
    signatureRequestId: input.requestId ?? "req_1",
    recipientId: input.recipientId ?? "rec_1",
    expiresAt: input.expiresAt ?? new Date(Date.now() + 60_000),
  });
}

describe("recipient access token", () => {
  it("mints and verifies a valid token", () => {
    const token = mint();
    const result = verifyRecipientAccessToken(token, {
      signatureRequestId: "req_1",
      recipientId: "rec_1",
    });
    assert.equal(result.ok, true);
  });

  it("rejects a token bound to a different recipient", () => {
    const token = mint();
    assert.equal(
      verifyRecipientAccessToken(token, {
        signatureRequestId: "req_1",
        recipientId: "rec_2",
      }).ok,
      false,
    );
  });

  it("rejects a token bound to a different request", () => {
    const token = mint();
    assert.equal(
      verifyRecipientAccessToken(token, {
        signatureRequestId: "req_2",
        recipientId: "rec_1",
      }).ok,
      false,
    );
  });

  it("rejects an expired token", () => {
    const token = mint({ expiresAt: new Date(Date.now() - 1000) });
    assert.equal(
      verifyRecipientAccessToken(token, {
        signatureRequestId: "req_1",
        recipientId: "rec_1",
      }).ok,
      false,
    );
  });

  it("rejects a forged token", () => {
    const forged = "req_1.rec_1.9999999999999.invalid.deadbeef";
    assert.equal(
      verifyRecipientAccessToken(forged, {
        signatureRequestId: "req_1",
        recipientId: "rec_1",
      }).ok,
      false,
    );
  });

  it("rejects an undefined token", () => {
    assert.equal(
      verifyRecipientAccessToken(undefined, {
        signatureRequestId: "req_1",
        recipientId: "rec_1",
      }).ok,
      false,
    );
  });

  it("tokens from different secrets do not verify", () => {
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "secret-a";
    const token = mintRecipientAccessToken({
      signatureRequestId: "req_1",
      recipientId: "rec_1",
      expiresAt: new Date(Date.now() + 60_000),
    });
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "secret-b";
    assert.equal(
      verifyRecipientAccessToken(token, {
        signatureRequestId: "req_1",
        recipientId: "rec_1",
      }).ok,
      false,
    );
  });

  it("throws when the verification secret is not configured (in production)", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.NEXT_PRIVATE_VERIFICATION_SECRET;
    // Simulate production environment where the fallback is not allowed
    (process.env as any).NODE_ENV = "production";
    delete process.env.NEXT_PRIVATE_VERIFICATION_SECRET;
    try {
      assert.throws(() =>
        mintRecipientAccessToken({
          signatureRequestId: "req_1",
          recipientId: "rec_1",
          expiresAt: new Date(Date.now() + 60_000),
        }),
      );
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalSecret !== undefined) {
        process.env.NEXT_PRIVATE_VERIFICATION_SECRET = originalSecret;
      }
    }
  });
});

describe("recipient access token expiry", () => {
  it("caps the token by the request's own expiry when it comes sooner", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const requestExpiresAt = new Date("2026-01-02T00:00:00.000Z");
    const expiry = computeRecipientAccessExpiry({
      now,
      requestExpiresAt,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
    });
    assert.equal(expiry.getTime(), requestExpiresAt.getTime());
  });

  it("uses the TTL when the request has no expiry", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiry = computeRecipientAccessExpiry({ now, requestExpiresAt: null });
    assert.equal(expiry.getTime(), now.getTime() + RECIPIENT_ACCESS_TOKEN_TTL_MS);
  });
});

describe("recipient access cookie", () => {
  it("reads and verifies the token from a cookie header", () => {
    const token = mint();
    const header = buildRecipientAccessCookieHeader({
      requestId: "req_1",
      token,
    });
    const read = readRecipientAccessFromCookies(header, {
      signatureRequestId: "req_1",
    });
    assert.deepEqual(read, { ok: true, recipientId: "rec_1" });
  });

  it("rejects a cookie for a different request", () => {
    const token = mint({ requestId: "req_2" });
    const header = buildRecipientAccessCookieHeader({
      requestId: "req_2",
      token,
    });
    assert.equal(
      readRecipientAccessFromCookies(header, {
        signatureRequestId: "req_1",
      }).ok,
      false,
    );
  });

  it("returns missing when no cookie is present", () => {
    assert.deepEqual(readRecipientAccessFromCookies(undefined, {
      signatureRequestId: "req_1",
    }), { ok: false, reason: "missing" });
  });

  it("builds a cookie name scoped to the request", () => {
    assert.equal(
      recipientAccessCookieName("req_1"),
      "dossier_signing_access_req_1",
    );
  });

  it("parses a round-tripped token", () => {
    const token = mint();
    const parsed = parseRecipientAccessToken(token);
    assert.equal(parsed?.signatureRequestId, "req_1");
    assert.equal(parsed?.recipientId, "rec_1");
  });
});
