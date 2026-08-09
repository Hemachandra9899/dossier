import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createProviderEventDedupeKey,
  providerEventPayloadSchema,
} from "@/modules/signing/domain/signing-event";

describe("createProviderEventDedupeKey", () => {
  it("is deterministic for identical deliveries", () => {
    const input = {
      event: "DOCUMENT_COMPLETED",
      externalId: "dossier:team:t:signature-request:r",
      documentId: 42,
    };
    assert.equal(createProviderEventDedupeKey(input), createProviderEventDedupeKey(input));
  });

  it("differs when the event changes", () => {
    const base = {
      externalId: "dossier:team:t:signature-request:r",
      documentId: 42,
    };
    assert.notEqual(
      createProviderEventDedupeKey({ ...base, event: "DOCUMENT_SIGNED" }),
      createProviderEventDedupeKey({ ...base, event: "DOCUMENT_COMPLETED" }),
    );
  });

  it("differs when the document id changes", () => {
    const base = {
      event: "DOCUMENT_COMPLETED",
      externalId: "dossier:team:t:signature-request:r",
    };
    assert.notEqual(
      createProviderEventDedupeKey({ ...base, documentId: 1 }),
      createProviderEventDedupeKey({ ...base, documentId: 2 }),
    );
  });

  it("produces a sha256 hex digest (64 chars)", () => {
    const key = createProviderEventDedupeKey({
      event: "DOCUMENT_SIGNED",
      documentId: 7,
    });
    assert.match(key, /^[a-f0-9]{64}$/);
  });
});

describe("providerEventPayloadSchema", () => {
  it("parses a valid Documenso webhook body", () => {
    const parsed = providerEventPayloadSchema.parse({
      event: "DOCUMENT_SIGNED",
      payload: { id: 42, externalId: "dossier:team:t:signature-request:r" },
    });
    assert.equal(parsed.payload.id, 42);
  });

  it("rejects a malformed body", () => {
    assert.throws(() =>
      providerEventPayloadSchema.parse({ event: "DOCUMENT_SIGNED" }),
    );
    assert.throws(() =>
      providerEventPayloadSchema.parse({
        event: "DOCUMENT_SIGNED",
        payload: { id: -1 },
      }),
    );
  });
});
