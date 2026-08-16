import { test } from "node:test";
import assert from "node:assert";
import { DossierFileStatus, SignatureRequestStatus } from "@prisma/client";
import { deriveFileStatus } from "@/features/files/file-status";

test("deriveFileStatus status derivation rules", async (t) => {
  await t.test("no requirements -> NEW", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.NEW,
      requirements: [],
      requiresSignature: false,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.NEW);
  });

  await t.test("open internal requirement -> COLLECTING", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.NEW,
      requirements: [{ status: "OPEN", hasExternalAssignment: false }],
      requiresSignature: false,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.COLLECTING);
  });

  await t.test("open client-assigned requirement -> WAITING_ON_CLIENT", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.NEW,
      requirements: [{ status: "OPEN", hasExternalAssignment: true }],
      requiresSignature: false,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.WAITING_ON_CLIENT);
  });

  await t.test("submitted requirement -> REVIEWING", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.NEW,
      requirements: [
        { status: "SUBMITTED", hasExternalAssignment: true },
        { status: "COMPLETED", hasExternalAssignment: false },
      ],
      requiresSignature: false,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.REVIEWING);
  });

  await t.test("NEEDS_CORRECTION remains sticky", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.NEEDS_CORRECTION,
      requirements: [{ status: "SUBMITTED", hasExternalAssignment: true }],
      requiresSignature: false,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.NEEDS_CORRECTION);
  });

  await t.test("all complete + no signing needed -> READY_TO_CLOSE", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.REVIEWING,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: false,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.READY_TO_CLOSE);
  });

  await t.test("all complete + signing required + no request -> READY_TO_SIGN", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.REVIEWING,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: true,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.READY_TO_SIGN);
  });

  await t.test("all complete + signing required + active signature -> SIGNING", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.READY_TO_SIGN,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: true,
      signatures: [SignatureRequestStatus.SENT],
    });
    assert.strictEqual(status, DossierFileStatus.SIGNING);
  });

  await t.test("all complete + signing required + completed signature -> READY_TO_CLOSE", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.SIGNING,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: true,
      signatures: [SignatureRequestStatus.COMPLETED],
    });
    assert.strictEqual(status, DossierFileStatus.READY_TO_CLOSE);
  });

  await t.test("completed old request + cancelled old request -> READY_TO_CLOSE", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.SIGNING,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: true,
      signatures: [
        SignatureRequestStatus.COMPLETED,
        SignatureRequestStatus.CANCELLED,
      ],
    });
    assert.strictEqual(status, DossierFileStatus.READY_TO_CLOSE);
  });

  await t.test("failed request only -> READY_TO_SIGN", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.SIGNING,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: true,
      signatures: [SignatureRequestStatus.FAILED],
    });
    assert.strictEqual(status, DossierFileStatus.READY_TO_SIGN);
  });

  await t.test("active request -> SIGNING", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.READY_TO_SIGN,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: true,
      signatures: [
        SignatureRequestStatus.DECLINED,
        SignatureRequestStatus.VIEWED,
      ],
    });
    assert.strictEqual(status, DossierFileStatus.SIGNING);
  });

  await t.test("COMPLETE remains sticky", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.COMPLETE,
      requirements: [{ status: "SUBMITTED", hasExternalAssignment: true }],
      requiresSignature: true,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.COMPLETE);
  });

  await t.test("READY_TO_CLOSE does not become COMPLETE automatically", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.READY_TO_CLOSE,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: false,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.READY_TO_CLOSE);
  });

  await t.test("ARCHIVED remains sticky", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.ARCHIVED,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: false,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.ARCHIVED);
  });
});
