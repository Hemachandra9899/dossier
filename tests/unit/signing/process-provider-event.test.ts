import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planProviderEventEffect } from "@/modules/signing/application/process-provider-event";
import type { ProviderEventMapper } from "@/modules/signing/application/context";
import { SigningStateError } from "@/modules/signing/domain/signing-errors";

const mapEventToStatus: ProviderEventMapper = (event) => {
  switch (event) {
    case "DOCUMENT_SENT":
      return "SENT";
    case "DOCUMENT_VIEWED":
      return "VIEWED";
    case "DOCUMENT_SIGNED":
      return "SIGNING";
    case "DOCUMENT_COMPLETED":
      return "COMPLETED";
    case "DOCUMENT_DECLINED":
      return "DECLINED";
    case "DOCUMENT_CANCELLED":
      return "CANCELLED";
    default:
      return null;
  }
};

describe("planProviderEventEffect", () => {
  it("maps a provider event to the next status", () => {
    const effect = planProviderEventEffect({
      event: "DOCUMENT_COMPLETED",
      currentStatus: "SIGNING",
      mapEventToStatus,
    });
    assert.deepEqual(effect, { nextStatus: "COMPLETED", timestampField: "completedAt" });
  });

  it("returns null for unknown events", () => {
    const effect = planProviderEventEffect({
      event: "SOME_UNKNOWN_EVENT",
      currentStatus: "SENT",
      mapEventToStatus,
    });
    assert.deepEqual(effect, { nextStatus: null, timestampField: null });
  });

  it("treats an event matching current status as an already-applied duplicate", () => {
    const effect = planProviderEventEffect({
      event: "DOCUMENT_VIEWED",
      currentStatus: "VIEWED",
      mapEventToStatus,
    });
    assert.deepEqual(effect, { nextStatus: null, timestampField: null });
  });

  it("treats a repeated COMPLETED delivery as a duplicate", () => {
    const effect = planProviderEventEffect({
      event: "DOCUMENT_COMPLETED",
      currentStatus: "COMPLETED",
      mapEventToStatus,
    });
    assert.deepEqual(effect, { nextStatus: null, timestampField: null });
  });

  it("sets cancelledAt timestamp for cancellation events", () => {
    const effect = planProviderEventEffect({
      event: "DOCUMENT_CANCELLED",
      currentStatus: "READY",
      mapEventToStatus,
    });
    assert.deepEqual(effect, { nextStatus: "CANCELLED", timestampField: "cancelledAt" });
  });

  it("has no timestamp field for intermediate transitions", () => {
    const effect = planProviderEventEffect({
      event: "DOCUMENT_SIGNED",
      currentStatus: "VIEWED",
      mapEventToStatus,
    });
    assert.deepEqual(effect, { nextStatus: "SIGNING", timestampField: null });
  });

  it("throws SigningStateError for impossible transitions", () => {
    assert.throws(
      () =>
        planProviderEventEffect({
          event: "DOCUMENT_COMPLETED",
          currentStatus: "DRAFT",
          mapEventToStatus,
        }),
      SigningStateError,
    );
  });
});
