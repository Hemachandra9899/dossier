import type { PageLink } from "./page-link";

export interface DocumentPreviewData {
  documentId: string;
  documentName: string;
  documentType: string;
  fileType: string;
  isVertical: boolean;
  numPages: number;
  advancedExcelEnabled?: boolean;
  /** True when a page-based document has not finished converting yet. */
  isProcessing?: boolean;
  pages?: {
    file: string | null;
    pageNumber: number;
    embeddedLinks?: string[];
    pageLinks?: PageLink[];
    metadata?: { width: number; height: number; scaleFactor: number };
  }[];
  file?: string;
  sheetData?: any;
  htmlContent?: string;
}
