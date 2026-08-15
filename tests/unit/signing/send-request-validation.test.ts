// SendRequest validation unit tests. The application use-case talks to the
// request repository directly, so these tests stub the whole context with a
// fake repo + fake provider and assert the field-validation contract:
//
//  - every signer needs >= 1 assigned field  (SIGNATURE_FIELDS_REQUIRED)
//  - every signer needs a signature field    (SIGNATURE_REQUIRED)
//  - non-sendable statuses are rejected       (SigningStateError)

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SigningContext } from "@/features/signing/application/context";
import { sendRequest } from "@/features/signing/application/send-request";
import type { SigningProvider } from "@/features/signing/providers/signing-provider";
import { SigningSendError, SigningStateError } from "@/features/signing/domain/signing-errors";

interface FakeRow {
  id: string;
  teamId: string;
  documentId: string;
  templateId: string;
  status: string;
  providerExternalId: string;
  providerEnvelopeId: string | null;
  expiresAt: Date | null;
  recipients: Array<{
    id: string;
    email: string | null;
    name: string | null;
    providerRecipientId: string | null;
    providerDocumentId: number | null;
  }>;
}

function makeRequest(status: string): FakeRow {
  return {
    id: "request-1",
    teamId: "team-1",
    documentId: "document-1",
    templateId: "template-1",
    status,
    providerExternalId: "ext-1",
    providerEnvelopeId: "envelope-1",
    expiresAt: null,
    recipients: [
      {
        id: "recipient-1",
        email: "alice@example.com",
        name: "Alice",
        providerRecipientId: "1",
        providerDocumentId: null,
      },
      {
        id: "recipient-2",
        email: "bob@example.com",
        name: null,
        providerRecipientId: "2",
        providerDocumentId: null,
      },
    ],
  };
}

function buildContext(options: {
  status?: string;
  fields?: Array<{ recipientId: number | string; type: string }>;
  request?: FakeRow;
}): { ctx: SigningContext; provider: FakeProvider; requests: FakeRequests } {
  const requests = new FakeRequests(options.request ?? makeRequest(options.status ?? "PREPARING"));
  const provider = new FakeProvider(options.fields ?? []);
  const ctx = {
    requests: requests as any,
    templates: {
      findById: async () => ({
        id: "template-1",
        status: "READY",
        providerTemplateId: "provider-template-1",
      }),
    },
    provider: provider as unknown as SigningProvider,
    getDocumentFileBytes: async () => Buffer.from("%PDF"),
    deliverEmail: async () => ({ id: "mock-email-id" }),
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  } as unknown as SigningContext;
  return { ctx, provider, requests };
}

class FakeRequests {
  row: FakeRow;
  updateStatusCalls: Array<{ status: string }> = [];

  constructor(row: FakeRow) {
    this.row = row;
  }

  async findByTeamAndIdWithRecipients(): Promise<FakeRow> {
    return this.row;
  }

  async findById(): Promise<FakeRow> {
    return this.row;
  }

  async findByIdWithRecipients(): Promise<FakeRow> {
    return this.row;
  }

  async updateStatus(_id: string, status: string) {
    this.updateStatusCalls.push({ status });
    this.row = { ...this.row, status };
    return this.row;
  }

  async updateRecipientProviderIds() {
    return {};
  }

  async createDelivery() {
    return { id: "delivery-1" };
  }

  async updateDeliveryStatus() {
    return {};
  }

  async createActivity() {
    return {};
  }

  async findTeamName() {
    return { name: "Test Team" };
  }

  async findDocumentName() {
    return { name: "Test Document" };
  }
}

class FakeProvider {
  fields: Array<{ recipientId: number | string; type: string }>;
  distributed: unknown = null;

  constructor(fields: Array<{ recipientId: number | string; type: string }>) {
    this.fields = fields;
  }

  async getEnvelope() {
    return { type: "DOCUMENT", status: "DRAFT", recipients: [], fields: this.fields };
  }

  async distributeEnvelope() {
    this.distributed = true;
    return {
      providerEnvelopeId: "envelope-1",
      recipients: [
        { providerRecipientId: 1, email: "alice@example.com", name: "Alice", signingStatus: "NOT_SIGNED", sendStatus: "SENT", readStatus: "NOT_OPENED" },
        { providerRecipientId: 2, email: "bob@example.com", name: null, signingStatus: "NOT_SIGNED", sendStatus: "SENT", readStatus: "NOT_OPENED" },
      ],
    };
  }
}

describe("sendRequest validation", () => {
  it("rejects requests in a non-sendable status", async () => {
    const { ctx } = buildContext({ status: "SIGNING" });
    await assert.rejects(
      sendRequest(ctx, { actor: { userId: "user-1", teamId: "team-1" }, requestId: "request-1" }),
      SigningStateError,
    );
  });

  it("rejects signers with no assigned fields (SIGNATURE_FIELDS_REQUIRED)", async () => {
    const { ctx } = buildContext({ status: "PREPARING", fields: [] });
    await assert.rejects(
      sendRequest(ctx, { actor: { userId: "user-1", teamId: "team-1" }, requestId: "request-1" }),
      (error: unknown) => {
        assert.ok(error instanceof SigningSendError);
        assert.equal(error.code, "SIGNATURE_FIELDS_REQUIRED");
        assert.deepEqual(error.recipients, ["alice@example.com", "bob@example.com"]);
        return true;
      },
    );
  });

  it("rejects signers missing a signature field (SIGNATURE_REQUIRED)", async () => {
    const { ctx } = buildContext({
      status: "PREPARING",
      fields: [
        { recipientId: 1, type: "TEXT" },
        { recipientId: 2, type: "SIGNATURE" },
      ],
    });
    await assert.rejects(
      sendRequest(ctx, { actor: { userId: "user-1", teamId: "team-1" }, requestId: "request-1" }),
      (error: unknown) => {
        assert.ok(error instanceof SigningSendError);
        assert.equal(error.code, "SIGNATURE_REQUIRED");
        assert.deepEqual(error.recipients, ["alice@example.com"]);
        return true;
      },
    );
  });

  it("only complains about the signers that actually lack signature fields", async () => {
    const { ctx } = buildContext({
      status: "READY",
      fields: [
        { recipientId: 1, type: "FREE_SIGNATURE" },
        { recipientId: 2, type: "TEXT" },
      ],
    });
    await assert.rejects(
      sendRequest(ctx, { actor: { userId: "user-1", teamId: "team-1" }, requestId: "request-1" }),
      (error: unknown) => {
        assert.ok(error instanceof SigningSendError);
        assert.equal(error.code, "SIGNATURE_REQUIRED");
        assert.deepEqual(error.recipients, ["bob@example.com"]);
        return true;
      },
    );
  });

  it("sends when every signer has an assigned signature field", async () => {
    const { ctx, provider, requests } = buildContext({
      status: "PREPARING",
      fields: [
        { recipientId: 1, type: "SIGNATURE" },
        { recipientId: 2, type: "FREE_SIGNATURE" },
      ],
    });

    const result = await sendRequest(ctx, {
      actor: { userId: "user-1", teamId: "team-1" },
      requestId: "request-1",
    });

    assert.equal(result.request.status, "SENT");
    assert.deepEqual(requests.updateStatusCalls, [
      { status: "READY" },
      { status: "SENT" },
    ]);
    assert.ok(provider.distributed);
  });
});
