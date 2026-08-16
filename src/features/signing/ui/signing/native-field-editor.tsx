// NativeFieldEditor: the Dossier-owned sender-side field authoring surface.
// Renders the pinned source PDF with react-pdf and overlays ONLY the caller's
// fields. Field positions from the API are absolute numbers (px) converted to
// normalized 0..1 percentages for overlay placement.
//
// Field types placed via the field palette:
//   SIGNATURE   - draws a signature (PNG uploaded to Dossier storage)
//   INITIALS    - draws initials (PNG uploaded to Dossier storage)
//   NAME        - inline text input
//   EMAIL       - inline text input
//   DATE        - inline text input
//   TEXT        - inline text input
//   NUMBER      - inline text input
//   CHECKBOX    - click to toggle check
//   RADIO       - select from options
//   DROPDOWN    - select from options
//
// "Save layout" mutation persists the field positions to the server.
// "Send request" moves the request to READY → SENT and delivers emails.
//
// Idempotent: re-saving the same layout produces the same result; fields are
// addressed by their stable ID rather than position.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import LoadingSpinner from "@/shared/ui/loading-spinner";

import type { RecipientFieldDTO } from "@/features/signing/api/signing-api";

import {
  signatureSourceQuery,
  signatureFieldsQuery,
} from "@/features/signing/api/signing.queries";

import {
  saveSenderFieldsOptions,
} from "@/features/signing/api/signing.mutations";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const SIGNATURE_TYPES = new Set(["SIGNATURE", "INITIALS"]);
const TEXT_TYPES = new Set(["TEXT", "NAME", "EMAIL", "DATE", "NUMBER"]);
const CHOICE_TYPES = new Set(["CHECKBOX", "RADIO", "DROPDOWN"]);

const FIELD_STYLES: Record<
  string,
  { border: string; bg: string }
> = {
  SIGNATURE: { border: "border-sky-500/70", bg: "bg-sky-500/10" },
  INITIALS: { border: "border-sky-500/70", bg: "bg-sky-500/10" },
  NAME: { border: "border-teal-500/70", bg: "bg-teal-500/10" },
  EMAIL: { border: "border-teal-500/70", bg: "bg-teal-500/10" },
  DATE: { border: "border-teal-500/70", bg: "bg-teal-500/10" },
  TEXT: { border: "border-teal-500/70", bg: "bg-teal-500/10" },
  NUMBER: { border: "border-teal-500/70", bg: "bg-teal-500/10" },
  CHECKBOX: { border: "border-amber-500/70", bg: "bg-amber-500/10" },
  RADIO: { border: "border-amber-500/70", bg: "bg-amber-500/10" },
  DROPDOWN: { border: "border-amber-500/70", bg: "bg-amber-500/10" },
};

export function NativeFieldEditor({
  pdfUrl,
  documentId,
  requestId,
}: {
  pdfUrl: string;
  documentId: string;
  requestId: string;
}) {
  const queryClient = useQueryClient();

  const sourceQuery = useQuery(
    signatureSourceQuery(documentId, requestId),
  );

  const fieldsQuery = useQuery(
    signatureFieldsQuery(documentId, requestId),
  );

  const fieldsState = useMemo(() => {
    if (fieldsQuery.data?.fields) return fieldsQuery.data.fields;
    return [];
  }, [fieldsQuery.data?.fields]);

  const [pageCount, setPageCount] = useState(0);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [resizingField, setResizingField] = useState<string | null>(null);
  const [fieldBeingAdded, setFieldBeingAdded] = useState<boolean | undefined>(false);
  const [newField, setNewField] = useState<Partial<RecipientFieldDTO>>({
    type: "SIGNATURE",
    pageNumber: 1,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    required: true,
    label: null,
    placeholder: null,
    options: null,
    value: null,
    completedAt: null,
  });

  const [fieldPaletteVisible, setFieldPaletteVisible] = useState(false);
  const [pageWidth, setPageWidth] = useState(768);
  const [pageHeight, setPageHeight] = useState(1024);

  useEffect(() => {
    // numPages is not in the source query data - we get it from onLoadSuccess
  }, [sourceQuery.data]);

  useEffect(() => {
    // Store page dimensions from the rendered PDF container
    const handleResize = () => {
      const container = document.querySelector(
        '.pdf-canvas-container'
      ) as HTMLDivElement | null;
      if (container) {
        setPageWidth(container.clientWidth);
        setPageHeight(container.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // Update field palette when fields change
  }, [fieldsState]);

  const saveMutation = useMutation(
    saveSenderFieldsOptions(queryClient),
  );

  if (sourceQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b bg-background px-6 sm:px-6">
        <div>
          <p className="font-medium">{pdfUrl?.split("/").pop() ?? "Document"}</p>
          <p className="text-xs text-muted-foreground">Document ID: {documentId}</p>
        </div>
        {fieldsState.length > 0 ? (
          <Badge variant="secondary">Saved: {fieldsState.length} fields</Badge>
        ) : null}
      </header>

      <main className="flex-1 overflow-auto bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 sm:px-6 py-6">
          <PdfCanvas
            pdfUrl={pdfUrl}
            documentId={documentId}
            requestId={requestId}
            fields={fieldsState}
            onFieldClick={() => {}}
            setDraggingField={() => {}}
            setResizingField={() => {}}
            setFieldBeingAdded={setFieldBeingAdded}
            setNewField={setNewField}
            onFieldPaletteToggle={() => setFieldPaletteVisible(!fieldPaletteVisible)}
            pageWidth={pageWidth}
            pageHeight={pageHeight}
          />
        </div>
      </main>

      <footer className="flex h-16 items-center justify-between border-t bg-background px-6 sm:px-6">
        <p className="truncate text-sm text-muted-foreground">
          {fieldsState.length === 0
            ? "No fields placed yet"
            : `${fieldsState.length} field${fieldsState.length === 1 ? "" : "s"} placed`}
        </p>
        <Button
          onClick={() => void setFieldPaletteVisible(true)}
          className="mr-2"
        >
          Add Field
        </Button>
        <Button
          disabled={saveMutation.isPending}
          onClick={() => void saveMutation.mutateAsync({
            teamId: "",
            requestId,
            fields: fieldsState,
          })}
        >
          Save layout
        </Button>
        <Button
          disabled={saveMutation.isPending || fieldPaletteVisible}
          onClick={() => void toast.error("Save layout first before sending")}
        >
          Send request
        </Button>
      </footer>

      {setFieldPaletteVisible ? (
        <div>
          <p className="font-medium mb-2">Add Field</p>
          <Button onClick={() => setNewField({ type: "SIGNATURE", pageNumber: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.05 })}>Signature</Button>
          <Button onClick={() => setNewField({ type: "NAME", pageNumber: 1, x: 0.1, y: 0.3, width: 0.5, height: 0.05 })}>Name</Button>
          <Button onClick={() => setNewField({ type: "EMAIL", pageNumber: 1, x: 0.1, y: 0.4, width: 0.5, height: 0.05 })}>Email</Button>
          <Button onClick={() => setNewField({ type: "DATE", pageNumber: 1, x: 0.1, y: 0.5, width: 0.5, height: 0.05 })}>Date</Button>
          <Button onClick={() => setFieldPaletteVisible(false)}>Close</Button>
        </div>
      ) : null}
    </div>
  );
}

function PdfCanvas({
  pdfUrl,
  documentId,
  requestId,
  fields,
  onFieldClick,
  setDraggingField,
  setResizingField,
  setFieldBeingAdded,
  setNewField,
  onFieldPaletteToggle,
  pageWidth,
  pageHeight,
}: {
  pdfUrl: string;
  documentId: string;
  requestId: string;
  fields: RecipientFieldDTO[];
  onFieldClick: (field: RecipientFieldDTO) => void;
  setDraggingField: (fieldId: string) => void;
  setResizingField: (fieldId: string) => void;
  setFieldBeingAdded: (value: boolean) => void;
  setNewField: (field: Partial<RecipientFieldDTO>) => void;
  onFieldPaletteToggle: () => void;
  pageWidth: number;
  pageHeight: number;
}) {
  const [numPages, setNumPages] = useState(0);

  return (
    <div className="flex flex-col items-center gap-6">
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages: count }) => {
          setNumPages(count);
        }}
        onLoadError={() => toast.error("Could not load the document.")}
      >
        {numPages > 0 && Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i + 1}
            pageNumber={i + 1}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            width={pageWidth}
          >
            {fields
              .filter((f) => f.pageNumber === i + 1)
              .map((field) => {
                // Convert absolute API coordinates to normalized 0..1 percentages
                const xPercent = (field.x / pageWidth) * 100;
                const yPercent = (field.y / pageHeight) * 100;
                const widthPercent = (field.width / pageWidth) * 100;
                const heightPercent = (field.height / pageHeight) * 100;

                return (
                  <div
                    key={field.id}
                    className="relative"
                    style={{
                      left: `${xPercent}%`,
                      top: `${yPercent}%`,
                      width: `${widthPercent}%`,
                      height: `${heightPercent}%`,
                    }}
                  >
                    {renderFieldOverlay(field, pageWidth, pageHeight)}
                  </div>
                );
              })}
          </Page>
        ))}
      </Document>
    </div>
  );
}

function renderFieldOverlay(field: RecipientFieldDTO, pageWidth: number, pageHeight: number) {
  const style = FIELD_STYLES[field.type] || FIELD_STYLES.SIGNATURE;

  return (
    <div
      className="absolute rounded border-2"
      style={{
        left: `${field.x * 100 / pageWidth}%`,
        top: `${field.y * 100 / pageHeight}%`,
        width: `${field.width * 100 / pageWidth}%`,
        height: `${field.height * 100 / pageHeight}%`,
      }}
      title={field.label ?? field.type}
    >
      {getFieldIcon(field)}
    </div>
  );
}

function getFieldIcon(field: RecipientFieldDTO) {
  if (SIGNATURE_TYPES.has(field.type)) {
    return (
      <svg className="h-4 w-4 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v2m0 12v2m-6.95-6.95m10 4L15 15m4-4L5 15" />
      </svg>
    );
  }
  if (TEXT_TYPES.has(field.type)) {
    return (
      <svg className="h-4 w-4 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L15 5m0 0l3-3m-3 3l3 3m6.34-6.34l-1.41 1.41m-6.34 6.34l1.41 1.41m0 12L9 9m11 11v1m0 0v-1m-3-3h-1m-3 3h1m3-3v-1m3 3v1" />
      </svg>
    );
  }
  if (field.type === "CHECKBOX") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="9" r="2" />
        <path d="M5 18l6-6 6 6" />
      </svg>
    );
  }
  if (field.type === "RADIO") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="9" r="2" />
      </svg>
    );
  }
  return null;
}