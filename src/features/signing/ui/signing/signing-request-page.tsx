// SigningRequestPage: the recipient-facing signing page for a Dossier
// SignatureRequest. Renders the request summary, opens the Documenso signing
// canvas in a sheet, and polls the public API until the request reaches a
// terminal state so completion never requires a reload. Access is proven by the
// HttpOnly recipient-access cookie (set at page entry); the page itself holds
// no secrets.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSignatureIcon,
  FileTextIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { PublicRecipientStatus } from "@/features/signing/application/get-public-request";

import { Button } from "@/shared/ui/button";
import LoadingSpinner from "@/shared/ui/loading-spinner";

import {
  signingApi,
  type PublicRequestDTO,
  type PublicSignedArtifactDTO,
  type SigningSessionDTO,
} from "../signing-api";
import { SignatureStatusBadge } from "../signature-status-badge";
import { SigningSheet } from "./signing-sheet";

const SIGNABLE_STATUSES: PublicRecipientStatus[] = [
  "READY",
  "SENT",
  "VIEWED",
  "SIGNING",
  "PARTIALLY_SIGNED",
];

const TERMINAL_NON_COMPLETED: PublicRecipientStatus[] = [
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
];

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

export function SigningRequestPage({ requestId }: { requestId: string }) {
  const [request, setRequest] = useState<PublicRequestDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<SigningSessionDTO | null>(null);
  const [isPreparingSession, setIsPreparingSession] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<PublicSignedArtifactDTO | null>(null);
  const pollActiveRef = useRef(false);

  const loadRequest = useCallback(async () => {
    try {
      const { request: loaded } = await signingApi.getPublicRequest({
        requestId,
      });
      setRequest(loaded);
      if (loaded.status === "COMPLETED") {
        const artifactResult = await signingApi
          .getPublicSignedArtifact({ requestId })
          .catch(() => null);
        setArtifact(artifactResult);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "This signature request could not be loaded.",
      );
    }
  }, [requestId]);

  useEffect(() => {
    if (!requestId) {
      setLoadError("This signature request could not be loaded.");
      return;
    }
    void loadRequest();
  }, [requestId, loadRequest]);

  const openSigning = async () => {
    setIsPreparingSession(true);
    try {
      const createdSession = await signingApi.createSigningSession({
        requestId,
      });
      setSession(createdSession);
      setSheetOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start the signing session.",
      );
    } finally {
      setIsPreparingSession(false);
    }
  };

  const handleDocumentCompleted = () => {
    setSheetOpen(false);
    void waitForCompletion(requestId);
  };

  const waitForCompletion = async (activeRequestId: string) => {
    if (pollActiveRef.current) return;
    pollActiveRef.current = true;
    setIsCompleting(true);
    setCompletionError(null);

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    try {
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        const result = await signingApi
          .getPublicRequest({ requestId: activeRequestId })
          .catch(() => null);
        if (!result) continue;
        const latest = result.request;

        if (latest.status === "COMPLETED") {
          setRequest(latest);
          const artifactResult = await signingApi
            .getPublicSignedArtifact({ requestId: activeRequestId })
            .catch(() => null);
          setArtifact(artifactResult);
          setIsCompleting(false);
          return;
        }

        if (TERMINAL_NON_COMPLETED.includes(latest.status)) {
          setRequest(latest);
          setCompletionError(
            `This signature request was ${latest.status.toLowerCase().replace("_", " ")}.`,
          );
          setIsCompleting(false);
          return;
        }
      }

      setCompletionError(
        "Your signature is still being processed. Refresh the page in a moment to download the signed copy.",
      );
    } finally {
      pollActiveRef.current = false;
      setIsCompleting(false);
    }
  };

  if (loadError) {
    return <NotFoundState message={loadError} />;
  }

  if (!request) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  const isSignable = SIGNABLE_STATUSES.includes(request.status);
  const isCompleted = request.status === "COMPLETED";
  const isTerminalFailed = TERMINAL_NON_COMPLETED.includes(request.status);
  const isExpired =
    request.status !== "EXPIRED" &&
    !!request.expiresAt &&
    new Date(request.expiresAt).getTime() <= Date.now();

  return (
    <div className="flex h-screen flex-col bg-secondary">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <FileSignatureIcon className="h-5 w-5 shrink-0" />
          <h1 className="truncate text-sm font-medium sm:text-base">
            {request.document.name}
          </h1>
        </div>
        <SignatureStatusBadge status={request.status} />
      </header>

      <main className="relative flex-1 overflow-hidden">
        {isCompleted ? (
          <CompletedState
            artifact={artifact}
            onRefresh={() => void loadRequest()}
          />
        ) : isTerminalFailed ? (
          <TerminalState
            status={request.status}
            message={completionError}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6">
            <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border bg-background p-8 text-center shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-secondary">
                <FileTextIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="truncate text-base font-semibold">
                  {request.document.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {request.recipient.name?.trim()
                    ? `Addressed to ${request.recipient.name.trim()}`
                    : "A signature request is waiting for you"}
                </p>
              </div>
              {isExpired ? (
                <p className="text-sm text-destructive">
                  This signature request has expired and is no longer available.
                </p>
              ) : isSignable ? (
                <p className="text-sm text-muted-foreground">
                  Review the document and sign it to return it to the sender.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {isSignable && !isExpired ? (
        <footer className="flex h-20 shrink-0 items-center justify-between border-t bg-background px-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {isCompleting ? "Completing your signature…" : "Awaiting your signature"}
            </p>
            {completionError ? (
              <p className="truncate text-xs text-destructive">
                {completionError}
              </p>
            ) : null}
          </div>
          <Button
            onClick={() => void openSigning()}
            loading={isPreparingSession || isCompleting}
          >
            {!isPreparingSession && !isCompleting ? (
              <FileSignatureIcon className="h-4 w-4" />
            ) : null}
            Review & Sign
          </Button>
        </footer>
      ) : null}

      <SigningSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        session={session}
        documentName={request.document.name}
        onCompleted={handleDocumentCompleted}
        onError={(message) => toast.error(message)}
      />
    </div>
  );
}

function CompletedState({
  artifact,
  onRefresh,
}: {
  artifact: PublicSignedArtifactDTO | null;
  onRefresh: () => void;
}) {
  const download = () => {
    if (!artifact?.downloadUrl) return;
    const anchor = document.createElement("a");
    anchor.href = artifact.downloadUrl;
    anchor.download = artifact.fileName ?? "signed-document.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <CheckCircle2Icon className="h-16 w-16 text-green-600 dark:text-green-500" />
      <h2 className="text-xl font-semibold">Document signed</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Thank you. The document has been signed and returned to the sender.
      </p>
      {artifact?.status === "completed" && artifact.downloadUrl ? (
        <Button onClick={download}>
          <DownloadIcon className="h-4 w-4" />
          Download signed copy
        </Button>
      ) : (
        <Button variant="outline" onClick={onRefresh}>
          <LoadingSpinner className="h-4 w-4" />
          Preparing signed copy…
        </Button>
      )}
    </div>
  );
}

function TerminalState({
  status,
  message,
}: {
  status: PublicRecipientStatus;
  message: string | null;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      <AlertCircleIcon className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">
        This signature request is {status.toLowerCase().replace("_", " ")}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {message ?? "This document is no longer available for signing."}
      </p>
    </div>
  );
}

function NotFoundState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <AlertCircleIcon className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Signature request not found</h2>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
