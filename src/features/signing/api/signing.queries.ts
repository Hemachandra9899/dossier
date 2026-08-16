// Signing query definitions. Each export is a statically-typed queryOptions
// object consumed via useQuery(). Polling is status-driven: active statuses
// poll every 5s, terminal statuses stop immediately, DRAFT/PREPARING/READY
// never poll.

import { queryOptions } from "@tanstack/react-query";

import {
  isSignatureRequestTerminal,
  shouldPollSignatureRequest,
  SIGNATURE_REQUEST_ACTIVE_POLL_INTERVAL_MS,
} from "@/features/signing/domain/signature-request";

import { signingApi } from "./signing-api";
import { signingKeys } from "./signing.keys";

const ARTIFACT_POLL_INTERVAL_MS = 3_000;

export function signatureRequestQuery(teamId: string, requestId: string) {
  return queryOptions({
    queryKey: signingKeys.requests.detail(teamId, requestId),
    queryFn: () => signingApi.getRequest({ teamId, requestId }),
    refetchInterval: (query) => {
      const status = query.state.data?.request?.status;
      if (!status) return false;
      return shouldPollSignatureRequest(status)
        ? SIGNATURE_REQUEST_ACTIVE_POLL_INTERVAL_MS
        : false;
    },
  });
}

export function activeSignatureRequestQuery(
  teamId: string | null | undefined,
  documentId: string | null | undefined,
) {
  return queryOptions({
    queryKey: signingKeys.requests.activeForDocument(
      teamId ?? "",
      documentId ?? "",
    ),
    queryFn: () =>
      signingApi.getActiveRequest({
        teamId: teamId as string,
        documentId: documentId as string,
      }),
    enabled: Boolean(teamId && documentId),
    refetchInterval: (query) => {
      const status = query.state.data?.request?.status;
      if (!status) return false;
      return shouldPollSignatureRequest(status)
        ? SIGNATURE_REQUEST_ACTIVE_POLL_INTERVAL_MS
        : false;
    },
  });
}

export function signedArtifactQuery(
  teamId: string,
  requestId: string,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: signingKeys.requests.artifact(teamId, requestId),
    queryFn: () => signingApi.getSignedArtifact({ teamId, requestId }),
    enabled,
    refetchInterval: (query) => {
      const artifact = query.state.data;
      if (!artifact) return false;
      return artifact.status === "pending" ? ARTIFACT_POLL_INTERVAL_MS : false;
    },
  });
}

export function publicSignatureRequestQuery(requestId: string) {
  return queryOptions({
    queryKey: signingKeys.public.request(requestId),
    queryFn: () => signingApi.getPublicRequest({ requestId }),
    enabled: Boolean(requestId),
    refetchInterval: (query) => {
      const status = query.state.data?.request?.status;
      if (!status) return false;
      return isSignatureRequestTerminal(status) ? false : ARTIFACT_POLL_INTERVAL_MS;
    },
  });
}

export function publicSignedArtifactQuery(
  requestId: string,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: signingKeys.public.artifact(requestId),
    queryFn: () => signingApi.getPublicSignedArtifact({ requestId }),
    enabled,
    refetchInterval: (query) => {
      const artifact = query.state.data;
      if (!artifact) return false;
      return artifact.status === "pending" ? ARTIFACT_POLL_INTERVAL_MS : false;
    },
  });
}

export function publicRecipientFieldsQuery(
  requestId: string,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: signingKeys.public.fields(requestId),
    queryFn: () => signingApi.getPublicFields({ requestId }),
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.fields?.some((f) => !f.complete)
        ? SIGNATURE_REQUEST_ACTIVE_POLL_INTERVAL_MS
        : false;
      return status;
    },
  });
}
