// Query-layer semantics: key factory shapes, dynamic polling decisions, and
// the READY != SENT link rule. These are pure functions / option builders, so
// they are tested without mounting React.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canExposeSigningLink,
  shouldPollSignatureRequest,
} from "@/features/signing/domain/signature-request";
import { signingKeys } from "@/features/signing/api/signing.keys";
import {
  publicSignatureRequestQuery,
  signatureRequestQuery,
} from "@/features/signing/api/signing.queries";

type QueryState = {
  state: { data: { request?: { status?: string } } | undefined };
};

function pollInterval(
  refetchInterval: ((query: unknown) => number | false | undefined) | false | undefined,
  status: string | undefined,
): number | false | undefined {
  if (typeof refetchInterval !== "function") return refetchInterval;
  return refetchInterval({
    state: { data: status ? { request: { status } } : undefined },
  } as QueryState);
}

describe("shouldPollSignatureRequest", () => {
  it("polls active in-flight statuses", () => {
    for (const status of ["SENT", "VIEWED", "SIGNING", "PARTIALLY_SIGNED"]) {
      assert.equal(shouldPollSignatureRequest(status as never), true, status);
    }
  });

  it("does not poll draft, preparing, ready or terminal statuses", () => {
    for (const status of [
      "DRAFT",
      "PREPARING",
      "READY",
      "COMPLETED",
      "DECLINED",
      "EXPIRED",
      "CANCELLED",
      "FAILED",
    ]) {
      assert.equal(shouldPollSignatureRequest(status as never), false, status);
    }
  });
});

describe("canExposeSigningLink", () => {
  it("exposes a link only after SENT", () => {
    for (const status of ["SENT", "VIEWED", "SIGNING", "PARTIALLY_SIGNED"]) {
      assert.equal(canExposeSigningLink(status as never), true, status);
    }
  });

  it("never exposes a link for READY, draft states or terminal states", () => {
    for (const status of [
      "DRAFT",
      "PREPARING",
      "READY",
      "COMPLETED",
      "DECLINED",
      "EXPIRED",
      "CANCELLED",
      "FAILED",
    ]) {
      assert.equal(canExposeSigningLink(status as never), false, status);
    }
  });
});

describe("signingKeys factory", () => {
  it("builds a stable, namespaced detail key", () => {
    assert.deepEqual(signingKeys.requests.detail("team_1", "req_1"), [
      "signing",
      "requests",
      "detail",
      "team_1",
      "req_1",
    ]);
  });

  it("distinguishes requests by team and id", () => {
    assert.notDeepEqual(
      signingKeys.requests.detail("team_1", "req_1"),
      signingKeys.requests.detail("team_2", "req_1"),
    );
    assert.notDeepEqual(
      signingKeys.requests.detail("team_1", "req_1"),
      signingKeys.requests.detail("team_1", "req_2"),
    );
  });

  it("keeps active-for-document and artifact keys distinct", () => {
    assert.notDeepEqual(
      signingKeys.requests.activeForDocument("team_1", "doc_1"),
      signingKeys.requests.detail("team_1", "req_1"),
    );
    assert.notDeepEqual(
      signingKeys.requests.artifact("team_1", "req_1"),
      signingKeys.requests.detail("team_1", "req_1"),
    );
    assert.notDeepEqual(
      signingKeys.public.request("req_1"),
      signingKeys.public.artifact("req_1"),
    );
  });

  it("never embeds token-like values", () => {
    const all = [
      ...signingKeys.requests.detail("t", "r"),
      ...signingKeys.requests.activeForDocument("t", "d"),
      ...signingKeys.requests.artifact("t", "r"),
      ...signingKeys.public.request("r"),
      ...signingKeys.public.artifact("r"),
    ];
    for (const part of all) {
      assert.equal(part.includes("token"), false);
      assert.equal(part.includes("access"), false);
    }
  });
});

describe("signatureRequestQuery polling", () => {
  it("polls every 5s while active", () => {
    const { refetchInterval } = signatureRequestQuery("team_1", "req_1");
    assert.equal(pollInterval(refetchInterval, "SENT"), 5_000);
    assert.equal(pollInterval(refetchInterval, "PARTIALLY_SIGNED"), 5_000);
  });

  it("stops polling for READY and terminal states", () => {
    const { refetchInterval } = signatureRequestQuery("team_1", "req_1");
    for (const status of [
      "DRAFT",
      "PREPARING",
      "READY",
      "COMPLETED",
      "DECLINED",
      "EXPIRED",
      "CANCELLED",
      "FAILED",
    ]) {
      assert.equal(pollInterval(refetchInterval, status), false, status);
    }
  });

  it("does not poll before the first fetch resolves", () => {
    const { refetchInterval } = signatureRequestQuery("team_1", "req_1");
    assert.equal(pollInterval(refetchInterval, undefined), false);
  });
});

describe("publicSignatureRequestQuery polling", () => {
  it("polls while the request is not terminal", () => {
    const { refetchInterval } = publicSignatureRequestQuery("req_1");
    assert.equal(pollInterval(refetchInterval, "READY"), 3_000);
    assert.equal(pollInterval(refetchInterval, "SENT"), 3_000);
  });

  it("stops polling on terminal states", () => {
    const { refetchInterval } = publicSignatureRequestQuery("req_1");
    for (const status of ["COMPLETED", "DECLINED", "EXPIRED", "CANCELLED"]) {
      assert.equal(pollInterval(refetchInterval, status), false, status);
    }
  });
});
