import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildRecipientSigningUrl } from "@/modules/signing/ui/signing-api";

const originalMarketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL;

afterEach(() => {
  if (originalMarketingUrl === undefined) {
    delete process.env.NEXT_PUBLIC_MARKETING_URL;
  } else {
    process.env.NEXT_PUBLIC_MARKETING_URL = originalMarketingUrl;
  }
});

describe("buildRecipientSigningUrl", () => {
  it("builds a per-recipient signing URL under the marketing origin", () => {
    process.env.NEXT_PUBLIC_MARKETING_URL = "https://example.com";

    assert.equal(
      buildRecipientSigningUrl({
        requestId: "req_123",
        recipientId: "rec_abc",
      }),
      "https://example.com/signing/req_123?recipient=rec_abc",
    );
  });

  it("falls back to a relative path when the origin is unset", () => {
    delete process.env.NEXT_PUBLIC_MARKETING_URL;

    assert.equal(
      buildRecipientSigningUrl({
        requestId: "req_123",
        recipientId: "rec_abc",
      }),
      "/signing/req_123?recipient=rec_abc",
    );
  });
});
