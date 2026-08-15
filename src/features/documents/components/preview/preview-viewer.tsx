import { useTeam } from "@/features/workspace/providers/workspace-provider";

import { DocumentPreviewData } from "@/shared/utils/types/document-preview";
import { HTML_DOCUMENT_IFRAME_SANDBOX } from "@/shared/utils/utils/html-document";

import { PreviewExcelViewer } from "./preview-excel-viewer";
import { PreviewImageViewer } from "./preview-image-viewer";
import { PreviewPagesViewer } from "./preview-pages-viewer";
import { PreviewPdfViewer } from "./preview-pdf-viewer";

interface PreviewViewerProps {
  documentData: DocumentPreviewData;
  onClose: () => void;
  initialPage?: number;
}

export function PreviewViewer({
  documentData,
  onClose,
  initialPage,
}: PreviewViewerProps) {
  const { currentTeamId } = useTeam();

  const previewPagesEndpoint = currentTeamId
    ? `/api/teams/${currentTeamId}/documents/${documentData.documentId}/preview-pages`
    : undefined;

  const renderViewer = () => {
    // Documents with page images (PDFs, docs, slides). Every page is an <img>.
    if (documentData.pages && documentData.pages.length > 0) {
      return (
        <PreviewPagesViewer
          documentData={documentData}
          onClose={onClose}
          pagesApiEndpoint={previewPagesEndpoint}
          initialPage={initialPage}
        />
      );
    }

    // Raw PDFs with no converted page images yet (or none at all). Rendered
    // inline with an inline Content-Disposition on the signed URL.
    if (documentData.fileType === "pdf" && documentData.file) {
      return (
        <PreviewPdfViewer documentData={documentData} onClose={onClose} />
      );
    }

    // Single image files
    if (documentData.fileType === "image" && documentData.file) {
      return (
        <PreviewImageViewer documentData={documentData} onClose={onClose} />
      );
    }

    // Excel/CSV files with advanced mode
    if (
      documentData.fileType === "sheet" &&
      documentData.advancedExcelEnabled &&
      documentData.file
    ) {
      return (
        <PreviewExcelViewer documentData={documentData} onClose={onClose} />
      );
    }

    // Excel/CSV files without advanced mode
    if (documentData.fileType === "sheet") {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400">
              Enable advanced Excel mode to preview this document.
            </p>
          </div>
        </div>
      );
    }

    if (documentData.fileType === "html" && documentData.htmlContent) {
      return (
        <iframe
          srcDoc={documentData.htmlContent}
          title={documentData.documentName || "HTML document"}
          className="h-full w-full rounded-lg border-0 bg-white"
          sandbox={HTML_DOCUMENT_IFRAME_SANDBOX}
          referrerPolicy="no-referrer"
          allow=""
        />
      );
    }

    // Notion documents (not fully supported yet)
    if (documentData.fileType === "notion") {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400">Notion document preview coming soon</p>
          </div>
        </div>
      );
    }

    // Fallback for unsupported types
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">
            Preview not available for this document type
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-full w-full rounded-lg bg-gray-900">
      {renderViewer()}
    </div>
  );
}
