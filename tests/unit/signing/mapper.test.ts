import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapDocumensoEventToStatus,
  mapDocumensoRecipientStatusToStatus,
} from "@/features/signing/providers/documenso/mapper";

describe("mapDocumensoEventToStatus", () => {
  it("maps DOCUMENT_SIGNED to PARTIALLY_SIGNED", () => {
    assert.equal(mapDocumensoEventToStatus("DOCUMENT_SIGNED"), "PARTIALLY_SIGNED");
  });

  it("maps DOCUMENT_COMPLETED to COMPLETED", () => {
    assert.equal(mapDocumensoEventToStatus("DOCUMENT_COMPLETED"), "COMPLETED");
  });

  it("maps DOCUMENT_REJECTED to DECLINED", () => {
    assert.equal(mapDocumensoEventToStatus("DOCUMENT_REJECTED"), "DECLINED");
  });

  it("maps DOCUMENT_CANCELLED to CANCELLED", () => {
    assert.equal(mapDocumensoEventToStatus("DOCUMENT_CANCELLED"), "CANCELLED");
  });

  it("maps RECIPIENT_EXPIRED to EXPIRED", () => {
    assert.equal(mapDocumensoEventToStatus("RECIPIENT_EXPIRED"), "EXPIRED");
  });

  it("returns null for unknown events (never maps to a Dossier status)", () => {
    assert.equal(mapDocumensoEventToStatus("DOCUMENT_CREATED"), null);
    assert.equal(mapDocumensoEventToStatus(""), null);
    assert.equal(mapDocumensoEventToStatus("bogus"), null);
  });
});

describe("mapDocumensoRecipientStatusToStatus", () => {
  it("maps provider recipient statuses to Dossier vocabulary", () => {
    assert.equal(mapDocumensoRecipientStatusToStatus("SIGNED"), "SIGNED");
    assert.equal(mapDocumensoRecipientStatusToStatus("REJECTED"), "DECLINED");
    assert.equal(mapDocumensoRecipientStatusToStatus("EXPIRED"), "EXPIRED");
    assert.equal(mapDocumensoRecipientStatusToStatus("OPENED"), "VIEWED");
    assert.equal(mapDocumensoRecipientStatusToStatus("IN_PROGRESS"), "SIGNING");
  });

  it("returns null for unknown recipient statuses", () => {
    assert.equal(mapDocumensoRecipientStatusToStatus("WAITING"), null);
    assert.equal(mapDocumensoRecipientStatusToStatus(null), null);
  });
});
