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
  it("builds a signing URL under the marketing origin carrying the token", () => {
    process.env.NEXT_PUBLIC_MARKETING_URL = "https://example.com";

    const url = buildRecipientSigningUrl({
      requestId: "req_123",
      token: "abc.def.123",
    });
    assert.ok(url.startsWith("https://example.com/signing/req_123?token="));
    assert.ok(url.includes(encodeURIComponent("abc.def.123")));
  });

  it("falls back to a relative path when the origin is unset", () => {
    delete process.env.NEXT_PUBLIC_MARKETING_URL;

    const url = buildRecipientSigningUrl({
      requestId: "req_123",
      token: "abc.def.123",
    });
    assert.ok(url.startsWith("/signing/req_123?token="));
  });
});
