// SigningRequestPage: the recipient-facing signing page for a Dossier
// SignatureRequest. Renders the document, opens the Documenso signing canvas
// in a sheet, and polls the public API until the request reaches a terminal
// state so completion never requires a reload.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileSignatureIcon,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";

import { isDossierSigningEnabled } from "@/modules/signing/config";
import type { SignatureRequestStatus } from "@/modules/signing/domain/signature-request";

import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";

import {
  signingApi,
  type PublicRequestDTO,
  type PublicSignedArtifactDTO,
  type SigningSessionDTO,
} from "../signing-api";
import { SignatureStatusBadge } from "../signature-status-badge";
import { SigningSheet } from "./signing-sheet";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const SIGNABLE_STATUSES: SignatureRequestStatus[] = [
  "READY",
  "SENT",
  "VIEWED",
  "SIGNING",
  "PARTIALLY_SIGNED",
];

const TERMINAL_NON_COMPLETED: SignatureRequestStatus[] = [
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
];

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

const pdfOptions = {
  cMapUrl: "cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "standard_fonts/",
};

export function SigningRequestPage({
  requestId,
  recipientId,
}: {
  requestId: string;
  recipientId: string | null;
}) {
  const [request, setRequest] = useState<PublicRequestDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<SigningSessionDTO | null>(null);
  const [isPreparingSession, setIsPreparingSession] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<PublicSignedArtifactDTO | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
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
    if (!isDossierSigningEnabled || !requestId) {
      setLoadError("This signature request could not be loaded.");
      return;
    }
    void loadRequest();
  }, [requestId, loadRequest]);

  const openSigning = async () => {
    if (!recipientId) return;
    setIsPreparingSession(true);
    try {
      const createdSession = await signingApi.createSigningSession({
        requestId,
        recipientId,
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

  if (!isDossierSigningEnabled) {
    return <NotFoundState message="This signature request could not be loaded." />;
  }

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
          <>
            <div
              className="flex h-full items-center"
              style={{ height: "calc(100vh - 136px)" }}
            >
              <div className="mx-auto flex h-full justify-center">
                <Document
                  file={request.document.fileUrl}
                  onLoadSuccess={({ numPages: nextNumPages }) =>
                    setNumPages(nextNumPages)
                  }
                  options={pdfOptions}
                  renderMode="canvas"
                  className=""
                >
                  <Page
                    className=""
                    key={pageNumber}
                    pageNumber={pageNumber}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    width={900}
                  />
                </Document>
              </div>
            </div>
            <div className="absolute left-2 top-1/2 z-10 -translate-y-1/2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous page"
                disabled={pageNumber <= 1}
                onClick={() =>
                  setPageNumber((current) => Math.max(1, current - 1))
                }
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </Button>
            </div>
            <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next page"
                disabled={pageNumber >= numPages}
                onClick={() =>
                  setPageNumber((current) =>
                    Math.min(numPages, current + 1),
                  )
                }
              >
                <ChevronRightIcon className="h-5 w-5" />
              </Button>
            </div>
          </>
        )}
      </main>

      {isSignable ? (
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
            disabled={!recipientId}
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
  status: SignatureRequestStatus;
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
