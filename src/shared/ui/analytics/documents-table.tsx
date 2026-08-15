import React from "react";
import Link from "next/link";
import { FileText, Upload, Plus } from "lucide-react";

export function DocumentsTable({
  startDate,
  endDate,
}: {
  startDate?: Date;
  endDate?: Date;
}) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
          <FileText className="h-6 w-6" />
        </div>
        <h4 className="text-base font-semibold text-foreground">Document Performance</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
          Upload PDF documents, decks, and contracts to track page-by-page viewing duration and drop-off rates.
        </p>
        <Link
          href="/files"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-all"
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </Link>
      </div>
    </div>
  );
}

export default DocumentsTable;
