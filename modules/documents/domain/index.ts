export type DocumentStatus = "ACTIVE" | "ARCHIVED" | "DELETED";

export interface DocumentMeta {
  id: string;
  name: string;
  url: string;
  storageType: string;
  fileSize?: number;
  contentType?: string;
}
