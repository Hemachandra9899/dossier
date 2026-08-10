import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeRecipientEmail,
  validateAndNormalizeRecipients,
} from "@/modules/signing/domain/recipient-validation";
import { SigningValidationError } from "@/modules/signing/domain/signing-errors";

describe("recipient validation + normalization", () => {
  it("normalizes emails to trimmed lowercase", () => {
    assert.equal(normalizeRecipientEmail("  Alice@EXAMPLE.com  "), "alice@example.com");
  });

  it("accepts a minimal valid recipient list", () => {
    const result = validateAndNormalizeRecipients([{ email: "A@B.com" }]);
    assert.equal(result.length, 1);
    assert.equal(result[0].email, "a@b.com");
    assert.equal(result[0].name, null);
    assert.equal(result[0].signingOrder, 1);
  });

  it("applies defaults for optional fields", () => {
    const result = validateAndNormalizeRecipients([
      { name: "   ", email: "a@b.com", phone: null },
    ]);
    assert.equal(result[0].name, null);
  });

  it("rejects an empty recipient list", () => {
    assert.throws(
      () => validateAndNormalizeRecipients([]),
      SigningValidationError,
    );
  });

  it("rejects invalid emails", () => {
    assert.throws(
      () => validateAndNormalizeRecipients([{ email: "not-an-email" }]),
      SigningValidationError,
    );
  });

  it("rejects duplicate emails case-insensitively", () => {
    assert.throws(
      () =>
        validateAndNormalizeRecipients([
          { email: "A@b.com" },
          { email: "a@B.COM" },
        ]),
      SigningValidationError,
    );
  });

  it("rejects more than 50 recipients", () => {
    const many = Array.from({ length: 51 }, (_, i) => ({
      email: `person${i}@example.com`,
    }));
    assert.throws(() => validateAndNormalizeRecipients(many), SigningValidationError);
  });

  it("rejects a non-array payload", () => {
    assert.throws(
      () => validateAndNormalizeRecipients({ email: "a@b.com" }),
      SigningValidationError,
    );
  });
});
