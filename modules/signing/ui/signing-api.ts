// Thin client wrapper around the Dossier signing APIs. Components never call
// fetch("/api/...") directly; everything goes through this module so the
// feature flag, error normalization and request shape stay in one place.

import { isDossierSigningEnabled } from "@/modules/signing/config";
import type { SignatureRequestStatus } from "@/modules/signing/domain/signature-request";
import type { SignatureTemplateStatus } from "@/modules/signing/domain/signature-template";

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

export interface SigningSessionDTO {
  requestId: string;
  recipientId: string;
  status: string;
  provider: "DOCUMENSO";
  host: string;
  token: string;
  externalId: string;
}

export interface PublicRequestDTO {
  id: string;
  status: SignatureRequestStatus;
  provider: string;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  document: {
    id: string;
    name: string;
    contentType: string | null;
    fileUrl: string;
  };
}

export interface PublicSignedArtifactDTO {
  status: "pending" | "completed";
  downloadUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export class SigningApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SigningApiError";
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  if (!isDossierSigningEnabled) {
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
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // keep the fallback
    }
    throw new SigningApiError(message, response.status);
  }

  return (await response.json()) as T;
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

  createRequest(input: {
    teamId: string;
    documentId: string;
    templateId: string;
    recipients: RecipientInput[];
    expiresAt?: string | null;
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
        }),
      },
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

  cancelRequest(input: { teamId: string; requestId: string }) {
    return request<{ request: RequestDTO }>(
      `/api/teams/${input.teamId}/signature-requests/${input.requestId}/cancel`,
      { method: "POST" },
    );
  },

  getPublicRequest(input: { requestId: string }) {
    return request<{ request: PublicRequestDTO }>(
      `/api/signature-requests/${input.requestId}`,
    );
  },

  getPublicSignedArtifact(input: { requestId: string }) {
    return request<PublicSignedArtifactDTO>(
      `/api/signature-requests/${input.requestId}/artifact`,
    );
  },

  createSigningSession(input: {
    requestId: string;
    recipientId: string;
    email?: string | null;
    name?: string | null;
  }) {
    return request<SigningSessionDTO>(
      `/api/signature-requests/${input.requestId}/session`,
      {
        method: "POST",
        body: JSON.stringify({
          recipientId: input.recipientId,
          email: input.email ?? null,
          name: input.name ?? null,
        }),
      },
    );
  },
};

/** Builds the per-recipient signing link the sender copies in the success step. */
export function buildRecipientSigningUrl(input: {
  requestId: string;
  recipientId: string;
}): string {
  const base = process.env.NEXT_PUBLIC_MARKETING_URL ?? "";
  return `${base}/signing/${input.requestId}?recipient=${input.recipientId}`;
}
