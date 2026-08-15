import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRequestExternalId,
  buildTemplateExternalId,
  isDossierSigningExternalId,
} from "@/features/signing/domain/external-id";

describe("external ids", () => {
  it("builds deterministic template external ids", () => {
    assert.equal(
      buildTemplateExternalId({ teamId: "team_1", templateId: "tpl_1" }),
      "dossier:team:team_1:signature-template:tpl_1",
    );
  });

  it("builds deterministic request external ids", () => {
    assert.equal(
      buildRequestExternalId({ teamId: "team_1", requestId: "req_1" }),
      "dossier:team:team_1:signature-request:req_1",
    );
  });

  it("is idempotent (same input -> same id)", () => {
    assert.equal(
      buildRequestExternalId({ teamId: "a", requestId: "b" }),
      buildRequestExternalId({ teamId: "a", requestId: "b" }),
    );
  });

  it("recognizes only dossier-minted external ids", () => {
    assert.equal(isDossierSigningExternalId("dossier:team:t:signature-request:r"), true);
    assert.equal(isDossierSigningExternalId("papermark:team:t:agreement:a"), false);
    assert.equal(isDossierSigningExternalId("12345"), false);
  });
});
