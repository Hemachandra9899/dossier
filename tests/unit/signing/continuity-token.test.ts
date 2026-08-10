import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  mintRequestSessionContinuityToken,
  verifyRequestSessionContinuityToken,
} from "@/modules/signing/domain/continuity-token";

const originalSecret = process.env.NEXT_PRIVATE_VERIFICATION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.NEXT_PRIVATE_VERIFICATION_SECRET;
  } else {
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = originalSecret;
  }
});

describe("signing session continuity token", () => {
  it("mints and verifies a valid token", () => {
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "test-secret";
    const token = mintRequestSessionContinuityToken({
      requestId: "req_1",
      recipientId: "rec_1",
    });
    assert.equal(
      verifyRequestSessionContinuityToken(token, {
        requestId: "req_1",
        recipientId: "rec_1",
      }),
      true,
    );
  });

  it("rejects a token bound to a different recipient", () => {
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "test-secret";
    const token = mintRequestSessionContinuityToken({
      requestId: "req_1",
      recipientId: "rec_1",
    });
    assert.equal(
      verifyRequestSessionContinuityToken(token, {
        requestId: "req_1",
        recipientId: "rec_2",
      }),
      false,
    );
  });

  it("rejects a token bound to a different request", () => {
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "test-secret";
    const token = mintRequestSessionContinuityToken({
      requestId: "req_1",
      recipientId: "rec_1",
    });
    assert.equal(
      verifyRequestSessionContinuityToken(token, {
        requestId: "req_2",
        recipientId: "rec_1",
      }),
      false,
    );
  });

  it("rejects a forged token", () => {
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "test-secret";
    const forged = "req_1:rec_1:deadbeef";
    assert.equal(
      verifyRequestSessionContinuityToken(forged, {
        requestId: "req_1",
        recipientId: "rec_1",
      }),
      false,
    );
  });

  it("rejects an undefined token", () => {
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "test-secret";
    assert.equal(
      verifyRequestSessionContinuityToken(undefined, {
        requestId: "req_1",
        recipientId: "rec_1",
      }),
      false,
    );
  });

  it("tokens from different secrets do not verify", () => {
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "secret-a";
    const token = mintRequestSessionContinuityToken({
      requestId: "req_1",
      recipientId: "rec_1",
    });
    process.env.NEXT_PRIVATE_VERIFICATION_SECRET = "secret-b";
    assert.equal(
      verifyRequestSessionContinuityToken(token, {
        requestId: "req_1",
        recipientId: "rec_1",
      }),
      false,
    );
  });

  it("throws when the verification secret is not configured", () => {
    delete process.env.NEXT_PRIVATE_VERIFICATION_SECRET;
    assert.throws(() =>
      mintRequestSessionContinuityToken({ requestId: "req_1", recipientId: "rec_1" }),
    );
  });
});
