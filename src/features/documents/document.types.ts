import type { DocumentStorageType } from "@prisma/client";

export type DocumentData = {
  name: string;
  key: string;
  storageType: DocumentStorageType;
  contentType: string | null;
  supportedFileType: string;
  fileSize: number | undefined;
  numPages?: number;
  enableExcelAdvancedMode?: boolean;
};

export interface DocumentMeta {
  id: string;
  name: string;
  url: string;
  storageType: string;
  fileSize?: number;
  contentType?: string;
}
