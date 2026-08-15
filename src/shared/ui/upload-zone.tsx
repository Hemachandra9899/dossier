import React from "react";

export interface RejectedFile {
  file: File;
  errors: Array<{ code: string; message: string }>;
}

export interface UploadItemState {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

export interface UploadBatchState {
  id: string;
  items: UploadItemState[];
  status: "pending" | "uploading" | "completed" | "error";
}

export function UploadZone(props: any) {
  return null;
}
