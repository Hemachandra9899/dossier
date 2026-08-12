import { test } from "node:test";
import assert from "node:assert";
import { DossierFileStatus, SignatureRequestStatus } from "@prisma/client";
import { deriveFileStatus } from "../../../modules/files/domain/file-status";

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

  await t.test("all complete + no signing needed -> COMPLETE", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.REVIEWING,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: false,
      signatures: [],
    });
    assert.strictEqual(status, DossierFileStatus.COMPLETE);
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
      signatures: [{ status: SignatureRequestStatus.SENT }],
    });
    assert.strictEqual(status, DossierFileStatus.SIGNING);
  });

  await t.test("all complete + signing required + completed signature -> COMPLETE", () => {
    const status = deriveFileStatus({
      currentStatus: DossierFileStatus.SIGNING,
      requirements: [{ status: "COMPLETED", hasExternalAssignment: true }],
      requiresSignature: true,
      signatures: [{ status: SignatureRequestStatus.COMPLETED }],
    });
    assert.strictEqual(status, DossierFileStatus.COMPLETE);
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
