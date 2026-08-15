import { useEffect, useState } from "react";

import { RefreshCwIcon } from "lucide-react";

import { DocumentPreviewData } from "@/shared/utils/types/document-preview";
import { cn } from "@/shared/utils/utils";

import { Button } from "@/shared/ui/button";

const PDF_LOAD_TIMEOUT_MS = 30_000;

interface PreviewPdfViewerProps {
  documentData: DocumentPreviewData;
  onClose: () => void;
}

/**
 * Renders the original (unconverted) PDF inline. Used while page previews are
 * being generated, or as a permanent fallback for PDFs that have no
 * DocumentPage rows. The file URL carries an inline Content-Disposition so the
 * PDF renders inside the iframe instead of being downloaded.
 */
export function PreviewPdfViewer({
  documentData,
  onClose,
}: PreviewPdfViewerProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const { file, documentName, isProcessing } = documentData;

  useEffect(() => {
    if (!file || failed) return;

    const timeout = setTimeout(() => {
      setFailed(true);
      setIframeLoaded(false);
    }, PDF_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [file, failed]);

  if (!file) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-gray-400">PDF preview not available</p>
      </div>
    );
  }

  const handleRetry = () => {
    setFailed(false);
    setIframeLoaded(false);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Document Title */}
      <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2">
        <div className="rounded-lg bg-black/20 px-3 py-2 text-white">
          <span className="text-sm font-medium">{documentName}</span>
        </div>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute left-4 top-4 z-50 flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-white">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <span className="text-xs">
            Page previews are still being generated. Showing the original PDF…
          </span>
        </div>
      )}

      {/* Loading indicator */}
      {!iframeLoaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      )}

      {/* Error state */}
      {failed && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400">This PDF could not be loaded.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="mt-3 text-gray-200"
            >
              <RefreshCwIcon className="mr-1 h-3 w-3" /> Retry
            </Button>
          </div>
        </div>
      )}

      {/* PDF iframe */}
      <div className="relative h-full w-full px-2 pb-2 pt-14">
        {!failed && (
          <iframe
            className={cn(
              "h-full w-full rounded-md transition-opacity duration-200",
              iframeLoaded ? "opacity-100" : "opacity-0",
            )}
            src={`${file}#toolbar=0&navpanes=0&view=FitH`}
            title={documentName || "PDF Document"}
            onLoad={() => setIframeLoaded(true)}
            onError={() => {
              setFailed(true);
              setIframeLoaded(false);
            }}
          />
        )}
        <div className="absolute bottom-2 left-2 right-2 z-50 h-[26px] rounded-b-md bg-gray-900" />
      </div>
    </div>
  );
}
