// Thin client wrapper around the Dossier signing APIs. Components never call
// fetch("/api/...") directly; everything goes through this module so the
// feature flag, error normalization and request shape stay in one place.

import { isDossierSigningEnabled } from "@/features/signing/config";
import type { SignatureRequestStatus } from "@/features/signing/domain/signature-request";
import type { SignatureTemplateStatus } from "@/features/signing/domain/signature-template";
import type { PublicRecipientStatus } from "@/features/signing/application/get-public-request";

export interface RecipientInput {
  name?: string | null;
  email: string;
  signingOrder: number;
}

export interface RecipientDTO {
  id: string;
  name: string | null;
  email: string | null;
  signingOrder: number;
  status: string;
}

export interface DeliveryDTO {
  id: string;
  recipientId: string;
  type: string;
  status: string;
  retryCount: number;
  lastAttemptAt: string | null;
  failedReason: string | null;
  createdAt: string;
}

export interface ActivityDTO {
  id: string;
  recipientId: string | null;
  type: string;
  timestamp: string;
  metadata: any;
}

export interface RequestDTO {
  id: string;
  teamId: string;
  documentId: string;
  templateId: string;
  status: SignatureRequestStatus;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  recipients: RecipientDTO[];
  deliveries: DeliveryDTO[];
  activities: ActivityDTO[];
}

export interface TemplateDTO {
  id: string;
  name: string;
  status: SignatureTemplateStatus;
  providerExternalId: string;
  providerTemplateId: string | null;
  providerEnvelopeId: string | null;
  documentId: string;
}

export interface EditorSessionDTO {
  templateId: string;
  provider: "DOCUMENSO";
  host: string;
  presignToken: string;
  envelopeId: string;
  externalId: string;
}

export type SigningSessionDTO = {
  requestId: string;
  recipientId: string;
  status: string;
} & (
  | { provider: "NATIVE"; sourceUrl: string; sourceSha256: string | null }
  | { provider: "DOCUMENSO"; host: string; token: string; externalId: string }
);

export interface PublicRequestDTO {
  id: string;
  status: PublicRecipientStatus;
  document: { name: string };
  recipient: { name: string | null };
  expiresAt: string | null;
  completedAt: string | null;
  canSign: boolean;
  canDownloadSignedCopy: boolean;
}

export interface PublicSignedArtifactDTO {
  status: "pending" | "completed";
  downloadUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export interface RecipientFieldDTO {
  id: string;
  type:
    | "SIGNATURE"
    | "INITIALS"
    | "NAME"
    | "EMAIL"
    | "DATE"
    | "TEXT"
    | "NUMBER"
    | "CHECKBOX"
    | "RADIO"
    | "DROPDOWN";
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  label: string | null;
  placeholder: string | null;
  options: unknown;
  value: unknown;
  complete: boolean;
  completedAt: string | null;
}

export interface RecipientAccessTokenDTO {
  token: string;
  expiresAt: string;
  recipientId: string;
}

export class SigningApiError extends Error {
  status: number;
  code?: string;
  recipients?: string[];

  constructor(message: string, status: number, code?: string, recipients?: string[]) {
    super(message);
    this.name = "SigningApiError";
    this.status = status;
    this.code = code;
    this.recipients = recipients;
  }
}

/**
 * Shared fetch wrapper. Sender endpoints are gated by the client-side CREATION
 * flag; public recipient endpoints pass `{ public: true }` so they keep working
 * whenever the runtime flag is on (server-side gate), regardless of the sender
 * creation toggle.
 */
async function request<T>(
  url: string,
  init?: RequestInit,
  opts?: { public?: boolean },
): Promise<T> {
  if (!opts?.public && !isDossierSigningEnabled) {
    throw new SigningApiError("Signing is not enabled.", 404);
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    let code: string | undefined;
    let recipients: string[] | undefined;
    try {
      const body = (await response.json()) as {
        message?: string;
        error?: string;
        recipients?: string[];
      };
      if (body.message) message = body.message;
      code = body.error;
      recipients = body.recipients;
    } catch {
      // keep the fallback
    }
    throw new SigningApiError(message, response.status, code, recipients);
  }

  return (await response.json()) as T;
}

export interface SignedArtifactDTO {
  requestId: string;
  status: "pending" | "completed";
  artifact?: {
    storageKey: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    sizeBytes: string;
  };
  downloadUrl?: string;
}

export const signingApi = {
  createTemplate(input: {
    teamId: string;
    documentId: string;
    name: string;
  }) {
    return request<{ template: TemplateDTO }>(
      `/api/teams/${input.teamId}/documents/${input.documentId}/signature-templates`,
      {
        method: "POST",
        body: JSON.stringify({ name: input.name }),
      },
    );
  },

  createEditorSession(input: { teamId: string; templateId: string }) {
    return request<{ session: EditorSessionDTO }>(
      `/api/teams/${input.teamId}/signature-templates/${input.templateId}/editor-session`,
      { method: "POST" },
    );
  },

  createDraft(input: {
    teamId: string;
    documentId: string;
    recipients: RecipientInput[];
    expiresAt?: string | null;
    dossierFileId?: string | null;
  }) {
    return request<{ request: RequestDTO }>(
      `/api/teams/${input.teamId}/signature-requests`,
      {
        method: "POST",
        body: JSON.stringify({
          documentId: input.documentId,
          recipients: input.recipients,
          expiresAt: input.expiresAt ?? null,
          dossierFileId: input.dossierFileId ?? null,
        }),
      },
    );
  },

  createRequest(input: {
    teamId: string;
    documentId: string;
    templateId: string;
    recipients: RecipientInput[];
    expiresAt?: string | null;
    dossierFileId?: string | null;
  }) {
    return request<{ requestId: string; status: SignatureRequestStatus }>(
      `/api/teams/${input.teamId}/signature-requests`,
      {
        method: "POST",
        body: JSON.stringify({
          documentId: input.documentId,
          templateId: input.templateId,
          recipients: input.recipients,
          expiresAt: input.expiresAt ?? null,
          dossierFileId: input.dossierFileId ?? null,
        }),
      },
    );
  },

  createRequestEditorSession(input: { teamId: string; requestId: string }) {
    return request<{ session: EditorSessionDTO }>(
      `/api/teams/${input.teamId}/signature-requests/${input.requestId}/editor-session`,
      { method: "POST" },
    );
  },

  sendRequest(input: { teamId: string; requestId: string }) {
    return request<{ request: RequestDTO }>(
      `/api/teams/${input.teamId}/signature-requests/${input.requestId}/send`,
      { method: "POST" },
    );
  },

  getRequest(input: { teamId: string; requestId: string }) {
    return request<{ request: RequestDTO }>(
      `/api/teams/${input.teamId}/signature-requests/${input.requestId}`,
    );
  },

  getActiveRequest(input: { teamId: string; documentId: string }) {
    return request<{ request: RequestDTO | null }>(
      `/api/teams/${input.teamId}/documents/${input.documentId}/signature-requests`,
    );
  },

  getRecipientAccessToken(input: {
    teamId: string;
    requestId: string;
    recipientId: string;
  }) {
    return request<{ access: RecipientAccessTokenDTO }>(
      `/api/teams/${input.teamId}/signature-requests/${input.requestId}/recipient-access-token?recipientId=${encodeURIComponent(input.recipientId)}`,
    );
  },

  remindRequest(input: { teamId: string; requestId: string; recipientId: string }) {
    return request<{ ok: boolean }>(
      `/api/teams/${input.teamId}/signature-requests/${input.requestId}/remind`,
      {
        method: "POST",
        body: JSON.stringify({ recipientId: input.recipientId }),
      },
    );
  },

  cancelRequest(input: { teamId: string; requestId: string }) {
    return request<{ request: RequestDTO }>(
      `/api/teams/${input.teamId}/signature-requests/${input.requestId}/cancel`,
      { method: "POST" },
    );
  },

  getSignedArtifact(input: { teamId: string; requestId: string }) {
    return request<SignedArtifactDTO>(
      `/api/teams/${input.teamId}/signature-requests/${input.requestId}/signed-artifact`,
    );
  },

  getPublicRequest(input: { requestId: string }) {
    return request<{ request: PublicRequestDTO }>(
      `/api/signature-requests/${input.requestId}`,
      undefined,
      { public: true },
    );
  },

  getPublicSignedArtifact(input: { requestId: string }) {
    return request<PublicSignedArtifactDTO>(
      `/api/signature-requests/${input.requestId}/artifact`,
      undefined,
      { public: true },
    );
  },

  exchangeRecipientAccessToken(input: { requestId: string; token: string }) {
    return request<{ ok: boolean }>(
      `/api/signature-requests/${input.requestId}/exchange`,
      { method: "POST", body: JSON.stringify({ token: input.token }) },
      { public: true },
    );
  },

  createSigningSession(input: { requestId: string }) {
    return request<SigningSessionDTO>(
      `/api/signature-requests/${input.requestId}/session`,
      { method: "POST", body: JSON.stringify({}) },
      { public: true },
    );
  },

  getPublicFields(input: { requestId: string }) {
    return request<{ fields: RecipientFieldDTO[] }>(
      `/api/signature-requests/${input.requestId}/fields`,
      undefined,
      { public: true },
    );
  },

  saveFieldResponse(input: {
    requestId: string;
    fieldId: string;
    value?: unknown;
    signatureStorageKey?: string | null;
  }) {
    return request<{ fieldId: string; complete: boolean }>(
      `/api/signature-requests/${input.requestId}/fields/${input.fieldId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          value: input.value,
          signatureStorageKey: input.signatureStorageKey,
        }),
      },
      { public: true },
    );
  },

  uploadSignatureImage(input: { requestId: string; data: string }) {
    return request<{ signatureStorageKey: string }>(
      `/api/signature-requests/${input.requestId}/signature`,
      {
        method: "POST",
        body: JSON.stringify({ data: input.data }),
      },
      { public: true },
    );
  },

  completeRecipient(input: { requestId: string }) {
    return request<{ request: RequestDTO }>(
      `/api/signature-requests/${input.requestId}/complete`,
      { method: "POST", body: JSON.stringify({}) },
      { public: true },
    );
  },
};

/**
 * Builds the per-recipient signing link the sender copies. The long-lived
 * invitation token is embedded in the URL; the recipient page exchanges it for
 * a short-lived HttpOnly cookie and scrubs it from the URL.
 */
export function buildRecipientSigningUrl(input: {
  requestId: string;
  token: string;
}): string {
  const base = process.env.NEXT_PUBLIC_MARKETING_URL ?? "";
  const query = new URLSearchParams({ token: input.token }).toString();
  return `${base}/signing/${input.requestId}?${query}`;
}
