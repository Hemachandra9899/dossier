// Step 2 — place signature fields on the document. Embeds the Documenso
// authoring canvas; Dossier owns the surrounding chrome. The Continue button
// stays disabled until the editor reports it is interactive.

import { AlertCircleIcon, ChevronLeftIcon } from "lucide-react";

import { DocumentPreviewData } from "@/shared/utils/types/document-preview";
import LoadingSpinner from "@/shared/ui/loading-spinner";
import { Button } from "@/shared/ui/button";

import { SignatureEditor } from "../signature-editor";
import type { EditorSessionDraft } from "./types";

export function PrepareStep({
  session,
  editorReady,
  isPreparing,
  error,
  previewData,
  onEditorReady,
  onRetry,
  onBack,
  onNext,
}: {
  session: EditorSessionDraft | null;
  editorReady: boolean;
  isPreparing: boolean;
  error: string | null;
  previewData?: DocumentPreviewData | null;
  onEditorReady: () => void;
  onRetry: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Signing is temporarily unavailable</p>
            <p className="text-sm text-muted-foreground">
              {error} Your document has not been changed. Try again in a moment.
            </p>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeftIcon className="h-4 w-4" />
            Back
          </Button>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!session || isPreparing) {
    const previewImage = previewData?.pages?.[0]?.file;
    const previewPdf =
      previewData?.fileType === "pdf" && previewData.file
        ? previewData.file
        : undefined;

    return (
      <div className="flex h-full min-h-[600px] flex-col items-center justify-center gap-3 rounded-lg border">
        {previewImage ? (
          <div className="relative w-full max-w-md overflow-hidden rounded-lg border">
            <img
              src={previewImage}
              alt={previewData.documentName}
              className="max-h-[420px] w-full object-contain"
              draggable={false}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
              <LoadingSpinner className="h-8 w-8" />
              <p className="text-sm text-white">
                {isPreparing ? "Preparing document…" : "Loading signature editor…"}
              </p>
            </div>
          </div>
        ) : previewPdf ? (
          <div className="relative w-full max-w-md overflow-hidden rounded-lg border">
            <iframe
              src={`${previewPdf}#toolbar=0&navpanes=0`}
              title={previewData?.documentName || "PDF document"}
              className="h-[420px] w-full border-0 bg-white"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
              <LoadingSpinner className="h-8 w-8" />
              <p className="text-sm text-white">
                {isPreparing ? "Preparing document…" : "Loading signature editor…"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <LoadingSpinner className="h-8 w-8" />
            <p className="text-sm text-muted-foreground">
              {isPreparing ? "Preparing document…" : "Loading signature editor…"}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SignatureEditor
        host={session.host}
        presignToken={session.presignToken}
        externalId={session.externalId}
        envelopeId={session.envelopeId}
        onReady={onEditorReady}
      />
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeftIcon className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!editorReady}>
          {editorReady ? "Continue to review" : "Loading signature editor…"}
        </Button>
      </div>
    </div>
  );
}
