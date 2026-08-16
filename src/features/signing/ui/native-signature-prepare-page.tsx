// NativeSignaturePreparePage: the native sender-side field authoring surface.
// Renders the pinned source PDF with react-pdf and overlays fields using the
// native field editor. No Documenso dependency.

"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, SendIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import LoadingSpinner from "@/shared/ui/loading-spinner";

import { signatureRequestQuery } from "@/features/signing/api/signing.queries";
import { signatureSourceQuery } from "@/features/signing/api/signing.queries";
import {
  saveSenderFieldsOptions,
  sendSignatureRequestOptions,
} from "@/features/signing/api/signing.mutations";
import { SigningApiError } from "@/features/signing/api/signing-api";
import { NativeFieldEditor } from "@/features/signing/ui/signing/native-field-editor";
import { SignatureStatusBadge } from "@/features/signing/ui/signature-status-badge";

export function NativeSignaturePreparePage({
  teamId,
  requestId,
  documentId,
  documentName,
}: {
  teamId: string;
  requestId: string;
  documentId: string;
  documentName: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const requestQuery = useQuery(signatureRequestQuery(teamId, requestId));
  const sourceQuery = useQuery(signatureSourceQuery(teamId, requestId));
  const status = requestQuery.data?.request?.status;
  const pdfUrl = sourceQuery.data?.url ?? `/api/teams/${teamId}/signature-requests/${requestId}/source`;

  const [sendError, setSendError] = useState<string | null>(null);

  const saveMutation = useMutation(saveSenderFieldsOptions(queryClient));
  const sendOptions = sendSignatureRequestOptions(queryClient);
  const sendMutation = useMutation({
    ...sendOptions,
    onSuccess: (result, input) => {
      sendOptions.onSuccess?.(result, input);
      void router.push(`/documents/${documentId}`);
    },
  });

  const handleSend = async () => {
    setSendError(null);
    try {
      await sendMutation.mutateAsync({ teamId, requestId });
    } catch (error) {
      if (error instanceof SigningApiError && error.code) {
        if (error.code === "SIGNATURE_FIELDS_REQUIRED") {
          setSendError(
            "Every signer needs at least one field assigned in the document before it can be sent.",
          );
          return;
        }
        if (error.code === "SIGNATURE_REQUIRED") {
          setSendError(
            "Every signer needs a signature field placed in the document before it can be sent.",
          );
          return;
        }
      }
      setSendError(
        error instanceof Error
          ? error.message
          : "The request could not be sent. Please try again.",
      );
    }
  };

  return (
    <div className="flex h-screen flex-col bg-secondary">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to document"
            onClick={() => void router.push(`/documents/${documentId}`)}
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{documentName}</h1>
            <div className="mt-0.5 flex items-center gap-2">
              {status ? <SignatureStatusBadge status={status} /> : null}
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Draft saved
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {sendMutation.isPending ? (
            <Button disabled>
              <LoadingSpinner className="mr-2 h-4 w-4" />
              Sending…
            </Button>
          ) : (
            <Button
              disabled={saveMutation.isPending || sendMutation.isPending}
              onClick={() => void handleSend()}
            >
              <SendIcon className="mr-2 h-4 w-4" />
              Send
            </Button>
          )}
        </div>
      </header>

      {sendError ? (
        <div className="border-b bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6">
          {sendError}
        </div>
      ) : null}

      <main className="min-h-0 flex-1 p-4 sm:p-6">
        <NativeFieldEditor
          pdfUrl={pdfUrl}
          requestId={requestId}
          documentId={documentId}
        />
      </main>
    </div>
  );
}