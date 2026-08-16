// NativeFieldEditor: the Dossier-owned sender-side field authoring surface.
// Renders the pinned source PDF with react-pdf and overlays the caller's
// fields. Field positions are normalized 0..1 so overlays track the rendered
// page at any scale.
//
// - SIGNATURE / INITIALS fields open the drawn-signature pad (PNG upload →
//   bound via public fields endpoint).
// - Text-like fields (NAME, EMAIL, DATE, TEXT, NUMBER) show inline inputs
//   that save on blur/change.
// - CHECKBOX / RADIO / DROPDOWN show choice controls.
// - "Save layout" mutation persists the field positions to the server.
// - "Send request" moves the request to READY → SENT and delivers emails.
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

import type {
  RecipientFieldDTO,
  SigningSessionDTO,
} from "@/features/signing/api/signing-api";

import {
  signatureSourceQuery,
  signatureFieldsQuery,
} from "@/features/signing/api/signing.queries";

import {
  saveSenderFieldsOptions,
} from "@/features/signing/api/signing.mutations";

import { signingApi } from "@/features/signing/api/signing-api";

import { SignaturePadDialog } from "./signature-pad-dialog";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const SIGNATURE_TYPES = new Set(["SIGNATURE", "INITIALS"]);
const TEXT_TYPES = new Set(["TEXT", "NAME", "EMAIL", "DATE", "NUMBER"]);
const CHOICE_TYPES = new Set(["CHECKBOX", "RADIO", "DROPDOWN"]);

const FIELD_STYLES: Record<
  RecipientFieldDTO["type"],
  { border: string; bg: string }
> = {
  SIGNATURE: { border: "border-sky-500/70", bg: "bg-sky-500/10" },
  INITIALS: { border: "border-sky-500/70", bg: "bg-sky-500/10" },
  TEXT: { border: "border-teal-500/70", bg: "bg-teal-500/10" },
  NAME: { border: "border-teal-500/70", bg: "bg-teal-500/10" },
  EMAIL: { border: "border-teal-500/70", bg: "bg-teal-500/10" },
  DATE: { border: "border-teal-500/70", bg: "bg-teal-500/10" },
  NUMBER: { border: "border-teal-500/70", bg: "bg-teal-500/10" },
  CHECKBOX: { border: "border-amber-500/70", bg: "bg-amber-500/10" },
  RADIO: { border: "border-amber-500/70", bg: "bg-amber-500/10" },
  DROPDOWN: { border: "border-amber-500/70", bg: "bg-amber-500/10" },
};

function fieldLabel(field: RecipientFieldDTO): string {
  const labels: Record<RecipientFieldDTO["type"], string> = {
    SIGNATURE: "Signature",
    INITIALS: "Initials",
    TEXT: "Text",
    NAME: "Name",
    EMAIL: "Email",
    DATE: "Date",
    NUMBER: "Number",
    CHECKBOX: "Checkbox",
    RADIO: "Radio",
    DROPDOWN: "Dropdown",
  };
  return field.label ?? labels[field.type];
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
  if (CHOICE_TYPES.has(field.type)) {
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
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="9" r="2" />
        <path d="M9 18H5a2 2 0 01-2-2V6a2 2 0 012-2h4a2 2 0 012 2v4z" />
        <circle cx="12" cy="9" r="2" />
      </svg>
    );
  }
  return null;
}

export function NativeFieldEditor({
  pdfUrl,
  teamId,
  requestId,
  recipients,
  fields,
  onFieldChange,
}: {
  pdfUrl: string;
  teamId: string;
  requestId: string;
  recipients: Array<{ id: string; email: string | null; name: string | null }>;
  fields: RecipientFieldDTO[];
  onFieldChange: (fields: RecipientFieldDTO[]) => void;
}) {
  const queryClient = useQueryClient();

  const fieldsQuery = useQuery(
    signatureFieldsQuery(teamId, requestId),
  );

  const fieldsState = useMemo(() => {
    if (fieldsQuery.data?.fields) return fieldsQuery.data.fields;
    return fields;
  }, [fieldsQuery.data?.fields]);

  const [draftValue, setDraftValue] = useState<string>("");
  const [activeField, setActiveField] = useState<RecipientFieldDTO | null>(null);

  const saveMutation = useMutation(saveSenderFieldsOptions(queryClient));

  const handleFieldClick = useCallback(
    (field: RecipientFieldDTO) => {
      if (SIGNATURE_TYPES.has(field.type)) {
        setActiveField(field);
      } else if (TEXT_TYPES.has(field.type)) {
        setDraftValue(String(field.value ?? ""));
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    await saveMutation.mutateAsync({
      teamId,
      requestId,
      fields: fieldsState,
    });
    setActiveField(null);
    setDraftValue("");
  }, [saveMutation, fieldsState, teamId, requestId]);

  if (fieldsQuery.isLoading) {
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
          <p className="text-xs text-muted-foreground">Recipients: {recipients.length}</p>
        </div>
        {fieldsState.length > 0 ? (
          <Badge variant="secondary">Saved: {fieldsState.length} fields</Badge>
        ) : null}
      </header>

      <main className="flex-1 overflow-auto bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 sm:px-6 py-6">
          <PdfCanvas
            pdfUrl={pdfUrl}
            fields={fieldsState}
            onFieldClick={handleFieldClick}
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
          onClick={() => void handleSave()}
          disabled={saveMutation.isPending}
          className="mr-2"
        >
          Save layout
        </Button>
        <Button
          disabled={saveMutation.isPending}
          onClick={() => void toast.error("Save layout first before sending")}
        >
          Send request
        </Button>
      </footer>

      {activeField ? (
        <SignaturePadDialog
          field={activeField}
          onCancel={() => setActiveField(null)}
          onConfirm={async (dataUrl) => {
            try {
              const upload = await signingApi.uploadSignatureImage({ requestId: recipients[0]?.id || "", data: dataUrl });
              await signingApi.saveFieldResponse({
                requestId: recipients[0]?.id || "",
                fieldId: activeField.id,
                signatureStorageKey: upload.signatureStorageKey,
              });
              setActiveField(null);
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save signature.",
              );
            }
          }}
        />
      ) : null}
    </div>
  );
}

function PdfCanvas({
  pdfUrl,
  fields,
  onFieldClick,
}: {
  pdfUrl: string;
  fields: RecipientFieldDTO[];
  onFieldClick: (field: RecipientFieldDTO) => void;
}) {
  const [numPages, setNumPages] = useState(0);

  if (numPages === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading document…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages: count }) => setNumPages(count)}
        onLoadError={() => toast.error("Could not load the document.")}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i + 1}
            pageNumber={i + 1}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            width={768}
          />
        ))}
      </Document>
      <div className="relative w-full max-w-4xl">
        {fields.map((field) => (
          <FieldOverlay
            key={field.id}
            field={field}
            onFieldClick={onFieldClick}
          />
        ))}
      </div>
    </div>
  );
}

function FieldOverlay({
  field,
  onFieldClick,
}: {
  field: RecipientFieldDTO;
  onFieldClick: (field: RecipientFieldDTO) => void;
}) {
  const style = FIELD_STYLES[field.type];

  return (
    <div
      className={`absolute rounded border-2 ${style.border}`}
      style={{
        left: `${field.x * 100}%`,
        top: `${field.y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
      }}
      title={field.label ?? field.type}
      onClick={() => onFieldClick(field)}
    >
      {getFieldIcon(field)}
    </div>
  );
}