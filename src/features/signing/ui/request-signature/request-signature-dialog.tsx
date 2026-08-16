// RequestSignatureDialog: recipients-only modal. Collects who signs (and
// optional expiry), then creates a DRAFT request and navigates to the full-page
// prepare screen where fields are placed. If the document already has an active
// request, a summary is shown instead of the form.

"use client";

import { useRouter } from "next/router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isDossierSigningEnabled } from "@/features/signing/config";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import LoadingSpinner from "@/shared/ui/loading-spinner";
import { useCopyToClipboard } from "@/shared/utils/utils/use-copy-to-clipboard";

import { activeSignatureRequestQuery } from "@/features/signing/api/signing.queries";
import { createSignatureDraftOptions } from "@/features/signing/api/signing.mutations";
import {
  type RecipientInput,
  type RequestDTO,
} from "@/features/signing/api/signing-api";
import { canExposeSigningLink, isSignatureRequestTerminal } from "@/features/signing/domain/signature-request";
import { SignatureStatusBadge } from "../signature-status-badge";
import { useRecipientSigningUrl } from "../use-recipient-signing-url";
import { RecipientStep } from "./recipient-step";

export function RequestSignatureDialog({
  open,
  onOpenChange,
  teamId,
  documentId,
  documentName,
  isPdf,
  onCreated,
  dossierFileId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  documentId: string;
  documentName: string;
  isPdf: boolean;
  onCreated?: (requestId: string) => void;
  dossierFileId?: string | null;
}) {
  const router = useRouter();
  const [recipients, setRecipients] = useState<RecipientInput[]>([
    { name: "", email: "", signingOrder: 1 },
  ]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const createDraftOptions = createSignatureDraftOptions(queryClient);
  const createDraftMutation = useMutation({
    ...createDraftOptions,
    onSuccess: (result, input) => {
      createDraftOptions.onSuccess?.(result, input);
      const requestId = result.request.id;
      onCreated?.(requestId);
      void router.push(`/signing/prepare/${requestId}`);
    },
  });

  // Active request lookup: staleTime 0 so reopening the dialog always reflects
  // the current server state even if the page-level query stopped polling after
  // a terminal state.
  const activeRequestQuery = useQuery({
    ...activeSignatureRequestQuery(teamId, documentId),
    staleTime: 0,
    enabled: open,
  });
  // Defensive filter: a stale cache (or a race where the server flipped the
  // request terminal after the fetch) must never surface a terminal request as
  // "in progress". FAILED/CANCELLED/DECLINED/EXPIRED/COMPLETED always resolve
  // to null so the recipient form stays usable.
  const returnedRequest = activeRequestQuery.data?.request;
  const activeRequest =
    returnedRequest && !isSignatureRequestTerminal(returnedRequest.status)
      ? returnedRequest
      : null;

  if (!isDossierSigningEnabled || !isPdf || !open) {
    return null;
  }

  const prepareDocument = async () => {
    setError(null);
    try {
      await createDraftMutation.mutateAsync({
        teamId,
        documentId,
        recipients,
        expiresAt,
        dossierFileId,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    }
  };

  const title =
    activeRequest != null
      ? "Signature request in progress"
      : "Request signature";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{documentName}</DialogDescription>
        </DialogHeader>

        {activeRequestQuery.isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <LoadingSpinner className="h-6 w-6" />
          </div>
        ) : activeRequest != null ? (
          <ActiveRequestSummary
            request={activeRequest}
            teamId={teamId}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
            <RecipientStep
              recipients={recipients}
              onChange={setRecipients}
              expiresAt={expiresAt}
              onExpiresAtChange={setExpiresAt}
              onNext={() => void prepareDocument()}
            />

            {createDraftMutation.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoadingSpinner className="h-4 w-4" />
                Creating draft…
              </div>
            ) : null}

            {error ? (
              <p
                className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActiveRequestSummary({
  request,
  teamId,
  onClose,
}: {
  request: RequestDTO;
  teamId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { isCopied, copyToClipboard } = useCopyToClipboard({});

  const firstRecipient = request.recipients[0];
  const linkable = canExposeSigningLink(request.status);
  const editable = request.status === "DRAFT" || request.status === "PREPARING" || request.status === "READY";

  const { url: signingUrl, isLoading, error } = useRecipientSigningUrl({
    teamId,
    requestId: request.id,
    recipientId: firstRecipient?.id ?? null,
    enabled: linkable,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SignatureStatusBadge status={request.status} />
      </div>
      <ul className="space-y-2">
        {request.recipients.map((recipient) => (
          <li
            key={recipient.id}
            className="flex items-center justify-between rounded-lg border p-3 text-sm"
          >
            <span className="truncate">
              {recipient.name?.trim() || "Unnamed signer"} · {recipient.email}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {recipient.status}
            </span>
          </li>
        ))}
      </ul>

      {signingUrl ? (
        <div className="flex items-center gap-2 rounded-lg border p-2">
          <code className="min-w-0 flex-1 truncate text-xs">{signingUrl}</code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              copyToClipboard(signingUrl, "Signing link copied to clipboard.");
            }}
          >
            {isCopied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : firstRecipient && linkable ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border p-2 text-sm text-muted-foreground">
          {isLoading ? (
            <>
              <LoadingSpinner className="h-4 w-4" />
              Preparing signing link…
            </>
          ) : (
            error ?? "Could not prepare the signing link."
          )}
        </div>
      ) : null}

      <DialogFooter className="gap-2 sm:justify-end">
        {editable ? (
          <Button
            variant="outline"
            onClick={() => void router.push(`/signing/prepare/${request.id}`)}
          >
            Continue preparing
          </Button>
        ) : null}
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </div>
  );
}
