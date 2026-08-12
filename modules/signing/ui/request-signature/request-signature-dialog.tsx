// RequestSignatureDialog: single controller for the whole flow. Hosted as a
// per-document dialog, it orchestrates recipients → prepare (template +
// editor session) → review → success. If the document already has an active
// request, a summary is shown instead of the wizard.

"use client";

import { useCallback, useEffect, useState } from "react";

import { isDossierSigningEnabled } from "@/modules/signing/config";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useCopyToClipboard } from "@/lib/utils/use-copy-to-clipboard";

import {
  signingApi,
  type RequestDTO,
} from "../signing-api";
import { SignatureStatusBadge } from "../signature-status-badge";
import { useRecipientSigningUrl } from "../use-recipient-signing-url";
import { PrepareStep } from "./prepare-step";
import {
  RequestSignatureProvider,
  useRequestSignature,
} from "./request-signature-context";
import { RecipientStep } from "./recipient-step";
import { ReviewStep } from "./review-step";
import { SuccessStep } from "./success-step";

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
  if (!isDossierSigningEnabled || !isPdf || !open) {
    return null;
  }

  return (
    <RequestSignatureProvider
      documentId={documentId}
      documentName={documentName}
    >
      <RequestSignatureDialogInner
        open={open}
        onOpenChange={onOpenChange}
        teamId={teamId}
        documentId={documentId}
        documentName={documentName}
        onCreated={onCreated}
        dossierFileId={dossierFileId}
      />
    </RequestSignatureProvider>
  );
}

function RequestSignatureDialogInner({
  open,
  onOpenChange,
  teamId,
  documentId,
  documentName,
  onCreated,
  dossierFileId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  documentId: string;
  documentName: string;
  onCreated?: (requestId: string) => void;
  dossierFileId?: string | null;
}) {
  const { state, dispatch } = useRequestSignature();

  const [activeRequest, setActiveRequest] = useState<
    RequestDTO | null | undefined
  >(undefined);
  const [successRecipientId, setSuccessRecipientId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setActiveRequest(undefined);

    signingApi
      .getActiveRequest({ teamId, documentId })
      .then(({ request }) => {
        if (!cancelled) setActiveRequest(request);
      })
      .catch(() => {
        if (!cancelled) setActiveRequest(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, teamId, documentId]);

  const prepareDocument = useCallback(async () => {
    dispatch({ type: "SET_ERROR", message: null });
    dispatch({ type: "CREATING_TEMPLATE", value: true });
    try {
      const { template } = await signingApi.createTemplate({
        teamId,
        documentId,
        name: documentName,
      });
      dispatch({ type: "SET_TEMPLATE", templateId: template.id });

      const { session } = await signingApi.createEditorSession({
        teamId,
        templateId: template.id,
      });
      dispatch({ type: "SET_EDITOR_SESSION", session });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        message: messageFromError(error),
      });
    } finally {
      dispatch({ type: "CREATING_TEMPLATE", value: false });
    }
  }, [teamId, documentId, documentName, dispatch]);

  useEffect(() => {
    if (
      state.step === "PREPARE" &&
      !state.editorSession &&
      !state.isCreatingTemplate &&
      !state.error
    ) {
      void prepareDocument();
    }
  }, [
    state.step,
    state.editorSession,
    state.isCreatingTemplate,
    state.error,
    prepareDocument,
  ]);

  const createRequest = async () => {
    if (!state.draft.templateId) return;
    dispatch({ type: "SET_ERROR", message: null });
    dispatch({ type: "CREATING_REQUEST", value: true });
    try {
      const result = await signingApi.createRequest({
        teamId,
        documentId,
        templateId: state.draft.templateId,
        recipients: state.draft.recipients,
        expiresAt: state.draft.expiresAt,
        dossierFileId,
      });
      dispatch({
        type: "SET_RESULT",
        requestId: result.requestId,
        status: result.status,
      });
      dispatch({ type: "GO_TO_STEP", step: "SUCCESS" });
      onCreated?.(result.requestId);

      try {
        const { request } = await signingApi.getRequest({
          teamId,
          requestId: result.requestId,
        });
        setSuccessRecipientId(request.recipients[0]?.id ?? null);
      } catch {
        setSuccessRecipientId(null);
      }
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        message: messageFromError(error),
      });
    } finally {
      dispatch({ type: "CREATING_REQUEST", value: false });
    }
  };

  const titles: Record<string, string> = {
    RECIPIENTS: "Request signature",
    PREPARE: "Prepare document",
    REVIEW: "Review and send",
    SUCCESS: "Done",
  };

  const title =
    activeRequest !== null && activeRequest !== undefined
      ? "Signature request in progress"
      : (titles[state.step] ?? "Request signature");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {documentName}
          </DialogDescription>
        </DialogHeader>

        {activeRequest === undefined ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <LoadingSpinner className="h-6 w-6" />
          </div>
        ) : activeRequest !== null ? (
          <ActiveRequestSummary
            request={activeRequest}
            teamId={teamId}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
            {state.step === "RECIPIENTS" ? (
              <RecipientStep
                recipients={state.draft.recipients}
                onChange={(recipients) =>
                  dispatch({ type: "SET_RECIPIENTS", recipients })
                }
                expiresAt={state.draft.expiresAt}
                onExpiresAtChange={(expiresAt) =>
                  dispatch({ type: "SET_EXPIRATION", expiresAt })
                }
                onNext={() => dispatch({ type: "GO_TO_STEP", step: "PREPARE" })}
              />
            ) : null}

            {state.step === "PREPARE" ? (
              <PrepareStep
                session={state.editorSession}
                editorReady={state.draft.editorReady}
                isPreparing={state.isCreatingTemplate}
                error={state.error}
                onEditorReady={() =>
                  dispatch({ type: "SET_EDITOR_READY", ready: true })
                }
                onRetry={() => void prepareDocument()}
                onBack={() => dispatch({ type: "GO_TO_STEP", step: "RECIPIENTS" })}
                onNext={() => dispatch({ type: "GO_TO_STEP", step: "REVIEW" })}
              />
            ) : null}

            {state.step === "REVIEW" ? (
              <ReviewStep
                documentName={documentName}
                recipients={state.draft.recipients}
                expiresAt={state.draft.expiresAt}
                isCreating={state.isCreatingRequest}
                onBack={() => dispatch({ type: "GO_TO_STEP", step: "PREPARE" })}
                onCreate={() => void createRequest()}
              />
            ) : null}

            {state.step === "SUCCESS" && state.result ? (
              <SuccessStep
                teamId={teamId}
                requestId={state.result.requestId}
                firstRecipientId={successRecipientId}
                status={state.result.status}
                onClose={() => onOpenChange(false)}
              />
            ) : null}

            {state.error &&
            state.step !== "PREPARE" &&
            state.step !== "SUCCESS" ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {state.error}
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
  const { isCopied, copyToClipboard } = useCopyToClipboard({});

  const firstRecipient = request.recipients[0];
  const linkable =
    request.status === "READY" ||
    request.status === "SENT" ||
    request.status === "VIEWED" ||
    request.status === "SIGNING" ||
    request.status === "PARTIALLY_SIGNED";

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

      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </div>
  );
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
