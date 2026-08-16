// Native signing lifecycle tests: save-field-response, complete-recipient and
// finalize-signature-request. These cover the Dossier-owned path where the
// provider is never contacted:
//
//  - saveFieldResponse validates request status + field ownership and marks a
//    field complete when its response satisfies the field domain.
//  - completeRecipient enforces the required-field contract, marks the
//    recipient SIGNED and either moves the request to PARTIALLY_SIGNED or
//    finalizes it when the last recipient signs.
//  - finalizeSignatureRequest stamps the pinned source with the responses,
//    stores the signed PDF and transitions the request to COMPLETED.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { PDFDocument } from "pdf-lib";

import type { SigningContext } from "@/features/signing/application/context";
import { saveFieldResponse } from "@/features/signing/application/save-field-response";
import { completeRecipient } from "@/features/signing/application/complete-recipient";
import { finalizeSignatureRequest } from "@/features/signing/application/finalize-signature-request";
import {
  SigningNotFoundError,
  SigningStateError,
  SigningValidationError,
} from "@/features/signing/domain/signing-errors";

// 1x1 transparent PNG used as the drawn-signature blob.
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

interface FakeRecipient {
  id: string;
  email: string | null;
  name: string | null;
  status: string;
  signingOrder: number;
  signedAt: Date | null;
}

interface FakeRequest {
  id: string;
  teamId: string;
  documentId: string;
  documentVersionId: string | null;
  provider: "NATIVE" | "DOCUMENSO";
  status: string;
  sourceSha256: string | null;
  expiresAt: Date | null;
  document: { name: string };
  recipients: FakeRecipient[];
}

interface FakeField {
  id: string;
  signatureRequestId: string;
  recipientId: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  required: boolean;
  options: unknown;
  value: unknown;
  signatureStorageKey: string | null;
  completedAt: Date | null;
}

function makeRequest(overrides: Partial<FakeRequest> = {}): FakeRequest {
  return {
    id: "request-1",
    teamId: "team-1",
    documentId: "document-1",
    documentVersionId: "version-1",
    provider: "NATIVE",
    status: "SIGNING",
    sourceSha256: null,
    expiresAt: null,
    document: { name: "Test Agreement" },
    recipients: [
      {
        id: "recipient-1",
        email: "alice@example.com",
        name: "Alice",
        status: "SIGNING",
        signingOrder: 1,
        signedAt: null,
      },
    ],
    ...overrides,
  };
}

function makeField(overrides: Partial<FakeField> = {}): FakeField {
  return {
    id: "field-1",
    signatureRequestId: "request-1",
    recipientId: "recipient-1",
    pageNumber: 1,
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.05,
    type: "SIGNATURE",
    required: true,
    options: null,
    value: null,
    signatureStorageKey: null,
    completedAt: null,
    ...overrides,
  };
}

function buildContext(overrides: {
  request?: FakeRequest;
  fields?: FakeField[];
  signatureImage?: Buffer;
}) {
  const request = overrides.request ?? makeRequest();
  const fields = overrides.fields ?? [];

  const statusCalls: string[] = [];
  const activityTypes: string[] = [];
  const signedRecipientIds: string[] = [];

  const requests = {
    findByIdForRecipient: async () => request,
    findByIdWithRecipients: async () => request,
    findByIdForMirror: async () => request,
    findById: async () => request,
    updateStatus: async (_id: string, status: string) => {
      statusCalls.push(status);
      request.status = status;
      return request;
    },
  };

  const documents = {
    findVersionForRequest: async () => ({
      version: { file: "source.pdf", storageType: "S3" },
    }),
  };

  const artifacts = {
    findByRequestId: async () => null,
    create: async (input: unknown) => ({ id: "artifact-1", ...(input as object) }),
  };

  const activities = {
    create: async (input: { type: string }) => {
      activityTypes.push(input.type);
      return { id: "activity-1" };
    },
  };

  const recipients = {
    updateStatus: async (id: string, status: string) => {
      signedRecipientIds.push(id);
      const recipient = request.recipients.find((r) => r.id === id);
      if (recipient) {
        recipient.status = status;
        recipient.signedAt = new Date();
      }
      return { id, status };
    },
  };

  const ctx = {
    requests: requests as any,
    documents: documents as any,
    artifacts: artifacts as any,
    activities: activities as any,
    recipients: recipients as any,
    fields: {
      findById: async (id: string) => {
        const field = fields.find((f) => f.id === id);
        if (!field) throw new SigningNotFoundError(`Signature field ${id} not found`);
        return field;
      },
      updateResponse: async (input: {
        fieldId: string;
        value?: unknown;
        signatureStorageKey?: string | null;
        completedAt?: Date | null;
      }) => {
        const field = fields.find((f) => f.id === input.fieldId);
        if (!field) throw new SigningNotFoundError(`Signature field ${input.fieldId} not found`);
        if (input.value !== undefined) field.value = input.value;
        if (input.signatureStorageKey !== undefined)
          field.signatureStorageKey = input.signatureStorageKey;
        if (input.completedAt !== undefined) field.completedAt = input.completedAt;
        return field;
      },
      listByRequestAndRecipient: async (_requestId: string, recipientId: string) =>
        fields.filter((f) => f.recipientId === recipientId),
      listByRequestId: async () => fields,
    },
    storage: {
      putSignedPdf: async () => "signed/team-1/request-1.pdf",
    },
    getDocumentFileBytes: async () => Buffer.from(await makeSourcePdf()),
    getSourceUrl: async () => "https://example.com/source.pdf",
    getSignatureImageBytes: async (storageKey: string) =>
      storageKey === "sig-key" ? (overrides.signatureImage ?? TRANSPARENT_PNG) : null,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  } as unknown as SigningContext;

  return { ctx, statusCalls, activityTypes, signedRecipientIds };
}

async function makeSourcePdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]);
  return Buffer.from(await pdf.save());
}

describe("saveFieldResponse", () => {
  it("rejects when the request is not signable", async () => {
    const { ctx } = buildContext({ request: makeRequest({ status: "COMPLETED" }) });
    await assert.rejects(
      saveFieldResponse(ctx, {
        requestId: "request-1",
        recipientId: "recipient-1",
        fieldId: "field-1",
        value: "x",
      }),
      SigningStateError,
    );
  });

  it("rejects when the field does not belong to the caller's recipient", async () => {
    const { ctx } = buildContext({
      fields: [makeField({ id: "field-1", recipientId: "other-recipient" })],
    });
    await assert.rejects(
      saveFieldResponse(ctx, {
        requestId: "request-1",
        recipientId: "recipient-1",
        fieldId: "field-1",
        value: "x",
      }),
      SigningNotFoundError,
    );
  });

  it("marks a signature field complete once a storage key is bound", async () => {
    const field = makeField({ type: "SIGNATURE" });
    const { ctx } = buildContext({ fields: [field] });

    const result = await saveFieldResponse(ctx, {
      requestId: "request-1",
      recipientId: "recipient-1",
      fieldId: "field-1",
      signatureStorageKey: "sig-key",
    });

    assert.equal(result.complete, true);
    assert.equal(field.signatureStorageKey, "sig-key");
    assert.ok(field.completedAt);
  });

  it("marks a text field complete only with a non-empty value", async () => {
    const field = makeField({ type: "TEXT", value: null });
    const { ctx } = buildContext({ fields: [field] });

    const incomplete = await saveFieldResponse(ctx, {
      requestId: "request-1",
      recipientId: "recipient-1",
      fieldId: "field-1",
      value: "",
    });
    assert.equal(incomplete.complete, false);

    const complete = await saveFieldResponse(ctx, {
      requestId: "request-1",
      recipientId: "recipient-1",
      fieldId: "field-1",
      value: "Alice",
    });
    assert.equal(complete.complete, true);
    assert.equal(field.value, "Alice");
  });

  it("rejects signatureStorageKey on non-signature fields", async () => {
    const { ctx } = buildContext({ fields: [makeField({ type: "TEXT" })] });
    await assert.rejects(
      saveFieldResponse(ctx, {
        requestId: "request-1",
        recipientId: "recipient-1",
        fieldId: "field-1",
        signatureStorageKey: "sig-key",
      }),
      SigningValidationError,
    );
  });
});

describe("completeRecipient", () => {
  it("rejects when required fields are incomplete", async () => {
    const { ctx } = buildContext({
      fields: [makeField({ type: "TEXT", required: true, value: null })],
    });
    await assert.rejects(
      completeRecipient(ctx, {
        requestId: "request-1",
        recipientId: "recipient-1",
      }),
      SigningValidationError,
    );
  });

  it("marks a recipient SIGNED and moves a multi-recipient request to PARTIALLY_SIGNED", async () => {
    const { ctx, statusCalls, activityTypes, signedRecipientIds } = buildContext({
      request: makeRequest({
        status: "SENT",
        recipients: [
          {
            id: "recipient-1",
            email: "alice@example.com",
            name: "Alice",
            status: "SIGNING",
            signingOrder: 1,
            signedAt: null,
          },
          {
            id: "recipient-2",
            email: "bob@example.com",
            name: "Bob",
            status: "SENT",
            signingOrder: 2,
            signedAt: null,
          },
        ],
      }),
      fields: [
        makeField({ id: "f1", recipientId: "recipient-1", type: "SIGNATURE", signatureStorageKey: "sig-key" }),
        makeField({ id: "f2", recipientId: "recipient-2", type: "SIGNATURE", signatureStorageKey: null }),
      ],
    });

    const result = await completeRecipient(ctx, {
      requestId: "request-1",
      recipientId: "recipient-1",
    });

    assert.deepEqual(signedRecipientIds, ["recipient-1"]);
    assert.ok(activityTypes.includes("RECIPIENT_SIGNED"));
    assert.ok(statusCalls.includes("PARTIALLY_SIGNED"));
    assert.equal(result.status, "PARTIALLY_SIGNED");
  });

  it("honors sequential signing order", async () => {
    const { ctx } = buildContext({
      request: makeRequest({
        recipients: [
          {
            id: "recipient-1",
            email: "alice@example.com",
            name: "Alice",
            status: "SENT",
            signingOrder: 2,
            signedAt: null,
          },
          {
            id: "recipient-2",
            email: "bob@example.com",
            name: "Bob",
            status: "SENT",
            signingOrder: 1,
            signedAt: null,
          },
        ],
      }),
      fields: [
        makeField({ id: "f1", recipientId: "recipient-1", type: "SIGNATURE", signatureStorageKey: "sig-key" }),
      ],
    });

    await assert.rejects(
      completeRecipient(ctx, {
        requestId: "request-1",
        recipientId: "recipient-1",
      }),
      SigningStateError,
    );
  });

  it("is a no-op for a recipient that already signed", async () => {
    const { ctx, statusCalls, signedRecipientIds } = buildContext({
      request: makeRequest({
        status: "SIGNING",
        recipients: [
          {
            id: "recipient-1",
            email: "alice@example.com",
            name: "Alice",
            status: "SIGNED",
            signingOrder: 1,
            signedAt: new Date(),
          },
        ],
      }),
    });

    const result = await completeRecipient(ctx, {
      requestId: "request-1",
      recipientId: "recipient-1",
    });

    assert.deepEqual(signedRecipientIds, []);
    assert.equal(result.status, "SIGNING");
    assert.ok(!statusCalls.includes("PARTIALLY_SIGNED"));
  });
});

describe("finalizeSignatureRequest", () => {
  it("stamps fields, stores the signed PDF and completes the request", async () => {
    const source = await makeSourcePdf();
    const sourceSha256 = createHash("sha256").update(source).digest("hex");

    const { ctx, statusCalls, activityTypes } = buildContext({
      request: makeRequest({
        status: "PARTIALLY_SIGNED",
        sourceSha256,
        recipients: [
          {
            id: "recipient-1",
            email: "alice@example.com",
            name: "Alice",
            status: "SIGNED",
            signingOrder: 1,
            signedAt: new Date(),
          },
        ],
      }),
      fields: [
        makeField({
          id: "f1",
          type: "SIGNATURE",
          signatureStorageKey: "sig-key",
        }),
        makeField({
          id: "f2",
          type: "NAME",
          value: "Alice Johnson",
        }),
      ],
    });

    const result = await finalizeSignatureRequest(ctx, { requestId: "request-1" });

    assert.equal(result.finalized, true);
    assert.match(result.storageKey, /\.pdf$/);
    assert.equal(result.sha256.length, 64);
    assert.ok(statusCalls.includes("COMPLETED"));
    assert.ok(activityTypes.includes("ARTIFACT_READY"));
    assert.ok(activityTypes.includes("REQUEST_COMPLETED"));
  });

  it("fails hard when the source hash does not match the pinned version", async () => {
    const { ctx } = buildContext({
      request: makeRequest({ status: "SIGNING", sourceSha256: "deadbeef".repeat(8) }),
    });

    await assert.rejects(
      finalizeSignatureRequest(ctx, { requestId: "request-1" }),
      SigningStateError,
    );
  });

  it("is idempotent when an artifact already exists", async () => {
    const { ctx, statusCalls } = buildContext({});
    (ctx.artifacts as any).findByRequestId = async () => ({ id: "artifact-1" });

    const result = await finalizeSignatureRequest(ctx, { requestId: "request-1" });

    assert.equal(result.finalized, false);
    assert.equal(result.reason, "already-finalized");
    assert.ok(statusCalls.includes("COMPLETED"));
  });

  it("refuses to finalize from a non-signing status", async () => {
    const { ctx } = buildContext({
      request: makeRequest({ status: "DRAFT" }),
    });

    const result = await finalizeSignatureRequest(ctx, { requestId: "request-1" });
    assert.equal(result.finalized, false);
    assert.equal(result.reason, "not-signing:DRAFT");
  });
});
