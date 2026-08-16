import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_FIELD_SIZE,
  getRemainingRequiredFields,
  getSignatureFieldTypeLabel,
  isFieldComplete,
  normalizedToPdfRect,
  normalizedToScreen,
  screenToNormalized,
} from "@/features/signing/domain/signature-field";
import type { SignatureFieldType } from "@prisma/client";

describe("signature field coordinates", () => {
  it("round-trips screen pixels through normalized coordinates", () => {
    const pageSize = { width: 800, height: 1000 };
    const pageRect = { left: 40, top: 20, width: 800, height: 1000 };

    const screenPoint = { x: 240, y: 120 };
    const normalized = screenToNormalized(screenPoint, pageRect);
    const back = normalizedToScreen(
      { x: normalized.x, y: normalized.y, width: 0.1, height: 0.05 },
      pageSize,
    );

    assert.ok(Math.abs(back.left - (240 - 40)) < 0.001);
    assert.ok(Math.abs(back.top - (120 - 20)) < 0.001);
  });

  it("normalizes to the page origin when the point is at the top-left", () => {
    const pageRect = { left: 100, top: 50, width: 500, height: 700 };
    assert.deepEqual(screenToNormalized({ x: 100, y: 50 }, pageRect), {
      x: 0,
      y: 0,
    });
  });

  it("normalizes to 1,1 at the bottom-right corner", () => {
    const pageRect = { left: 0, top: 0, width: 500, height: 700 };
    assert.deepEqual(screenToNormalized({ x: 500, y: 700 }, pageRect), {
      x: 1,
      y: 1,
    });
  });

  it("returns zeros when the page has no size", () => {
    assert.deepEqual(
      screenToNormalized({ x: 10, y: 10 }, { left: 0, top: 0, width: 0, height: 0 }),
      { x: 0, y: 0 },
    );
  });

  it("converts a normalized rect into bottom-left PDF coordinates", () => {
    const pageSize = { width: 612, height: 792 };
    // A field occupying the top-left quarter of the page.
    const pdf = normalizedToPdfRect(
      { x: 0.1, y: 0.1, width: 0.25, height: 0.08 },
      pageSize,
    );
    assert.ok(Math.abs(pdf.x - 61.2) < 0.001);
    // y flipped from top to bottom, height subtracted
    assert.ok(Math.abs(pdf.y - (792 - 79.2 - 63.36)) < 0.001);
    assert.ok(Math.abs(pdf.width - 153) < 0.001);
    assert.ok(Math.abs(pdf.height - 63.36) < 0.001);
  });
});

describe("signature field completion", () => {
  const base = {
    type: "TEXT" as SignatureFieldType,
    value: null,
    signatureStorageKey: null,
  };

  it("completes text-like fields with a non-empty value", () => {
    assert.equal(isFieldComplete({ ...base, type: "TEXT", value: "Jane" }), true);
    assert.equal(isFieldComplete({ ...base, type: "TEXT", value: "  " }), false);
    assert.equal(isFieldComplete({ ...base, type: "EMAIL", value: "" }), false);
  });

  it("completes signature and initials only via a storage key", () => {
    assert.equal(
      isFieldComplete({ ...base, type: "SIGNATURE", signatureStorageKey: "sig/key" }),
      true,
    );
    assert.equal(isFieldComplete({ ...base, type: "SIGNATURE", value: "x" }), false);
    assert.equal(
      isFieldComplete({ ...base, type: "INITIALS", signatureStorageKey: "sig/key" }),
      true,
    );
  });

  it("completes checkbox only with an explicit true", () => {
    assert.equal(isFieldComplete({ ...base, type: "CHECKBOX", value: true }), true);
    assert.equal(isFieldComplete({ ...base, type: "CHECKBOX", value: false }), false);
    assert.equal(isFieldComplete({ ...base, type: "CHECKBOX" }), false);
  });

  it("completes radio/dropdown only with a valid option", () => {
    const options = ["red", "blue"];
    assert.equal(
      isFieldComplete({ ...base, type: "DROPDOWN", value: "red", options }),
      true,
    );
    assert.equal(
      isFieldComplete({ ...base, type: "DROPDOWN", value: "green", options }),
      false,
    );
    assert.equal(isFieldComplete({ ...base, type: "RADIO", value: "blue" }), true);
  });
});

describe("remaining required fields", () => {
  const field = (overrides: Partial<Parameters<typeof isFieldComplete>[0]> & { id: string }) =>
    ({
      id: overrides.id,
      type: "TEXT" as SignatureFieldType,
      value: null,
      signatureStorageKey: null,
      required: true,
      ...overrides,
    }) as never;

  it("returns only required fields that are incomplete", () => {
    const fields = [
      field({ id: "a", value: "done" }),
      field({ id: "b" }),
      field({ id: "c", required: false }),
    ];
    const remaining = getRemainingRequiredFields(fields);
    assert.deepEqual(
      remaining.map((f) => f.id),
      ["b"],
    );
  });
});

describe("field catalog", () => {
  it("exposes a default size for every field type", () => {
    for (const type of [
      "SIGNATURE",
      "INITIALS",
      "NAME",
      "EMAIL",
      "DATE",
      "TEXT",
      "NUMBER",
      "CHECKBOX",
      "RADIO",
      "DROPDOWN",
    ] as SignatureFieldType[]) {
      assert.ok(DEFAULT_FIELD_SIZE[type].width > 0);
      assert.ok(DEFAULT_FIELD_SIZE[type].height > 0);
      assert.ok(getSignatureFieldTypeLabel(type).length > 0);
    }
  });
});
