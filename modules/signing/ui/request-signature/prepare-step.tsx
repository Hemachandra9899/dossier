// Step 2 — place signature fields on the document. Embeds the Documenso
// authoring canvas; Dossier owns the surrounding chrome. The Continue button
// stays disabled until the editor reports it is interactive.

import { AlertCircleIcon, ChevronLeftIcon } from "lucide-react";

import LoadingSpinner from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";

import { SignatureEditor } from "../signature-editor";
import type { EditorSessionDraft } from "./types";

export function PrepareStep({
  session,
  editorReady,
  isPreparing,
  error,
  onEditorReady,
  onRetry,
  onBack,
  onNext,
}: {
  session: EditorSessionDraft | null;
  editorReady: boolean;
  isPreparing: boolean;
  error: string | null;
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
    return (
      <div className="flex h-full min-h-[600px] flex-col items-center justify-center gap-3 rounded-lg border">
        <LoadingSpinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">
          {isPreparing ? "Preparing document…" : "Loading signature editor…"}
        </p>
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
