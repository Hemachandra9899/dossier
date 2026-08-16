// NativeRecipientSigningView: the Dossier-owned recipient signing surface. It
// renders the pinned source PDF (from the native signing session) with
// react-pdf and overlays ONLY the caller's fields. Field positions are
// normalized 0..1 so overlays track the rendered page at any scale.
//
// - SIGNATURE / INITIALS fields open the drawn-signature pad; the PNG is
//   uploaded to Dossier storage and the returned storage key is bound to the
//   field via the public fields endpoint.
// - Text-like fields save on change; checkbox/radio/dropdown save on click.
// - "Sign document" calls the recipient complete endpoint, which natively
//   finalizes the signed PDF when this is the last outstanding recipient.

"use client";

import { useCallback, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";

import {
  CheckIcon,
  ChevronDownIcon,
  FileSignatureIcon,
  PenLineIcon,
} from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import LoadingSpinner from "@/shared/ui/loading-spinner";

import type {
  RecipientFieldDTO,
  SigningSessionDTO,
} from "@/features/signing/api/signing-api";

import {
  completeRecipientOptions,
  saveFieldResponseOptions,
  uploadSignatureImageOptions,
} from "@/features/signing/api/signing.mutations";

import { publicRecipientFieldsQuery } from "@/features/signing/api/signing.queries";

import { SignaturePadDialog } from "./signature-pad-dialog";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const SIGNATURE_TYPES = new Set(["SIGNATURE", "INITIALS"]);
const TEXT_TYPES = new Set(["TEXT", "NAME", "EMAIL", "DATE", "NUMBER"]);
const CHOICE_TYPES = new Set(["CHECKBOX", "RADIO", "DROPDOWN"]);

const FIELD_LABELS: Record<RecipientFieldDTO["type"], string> = {
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

const FIELD_ACCENTS: Record<RecipientFieldDTO["type"], string> = {
  SIGNATURE: "border-sky-500 bg-sky-500/10",
  INITIALS: "border-sky-500 bg-sky-500/10",
  TEXT: "border-teal-500 bg-teal-500/10",
  NAME: "border-teal-500 bg-teal-500/10",
  EMAIL: "border-teal-500 bg-teal-500/10",
  DATE: "border-teal-500 bg-teal-500/10",
  NUMBER: "border-teal-500 bg-teal-500/10",
  CHECKBOX: "border-amber-500 bg-amber-500/10",
  RADIO: "border-amber-500 bg-amber-500/10",
  DROPDOWN: "border-amber-500 bg-amber-500/10",
};

function fieldOptions(field: RecipientFieldDTO): string[] {
  const options = field.options as
    | Array<{ value?: string; label?: string } | string>
    | { options?: Array<{ value?: string; label?: string } | string> }
    | null;
  const list = Array.isArray(options) ? options : options?.options;
  if (!Array.isArray(list)) return [];
  return list.map((item) =>
    typeof item === "string"
      ? item
      : (item?.label ?? item?.value ?? String(item)),
  );
}

export function NativeRecipientSigningView({
  requestId,
  session,
  recipientName,
  documentName,
  onCompleted,
  onError,
}: {
  requestId: string;
  session: Extract<SigningSessionDTO, { provider: "NATIVE" }>;
  recipientName?: string | null;
  documentName: string;
  onCompleted: () => void;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [signingField, setSigningField] = useState<RecipientFieldDTO | null>(null);

  const fieldsQuery = useQuery(publicRecipientFieldsQuery(requestId, true));
  const fields = fieldsQuery.data?.fields ?? [];

  const saveFieldResponse = useMutation(saveFieldResponseOptions(queryClient));
  const completeRecipient = useMutation(completeRecipientOptions(queryClient));

  const progress = useMemo(() => {
    const fieldList = fieldsQuery.data?.fields ?? [];
    if (fieldList.length === 0) return { done: 0, total: 0, remaining: 0 };
    const done = fieldList.filter((field) => field.complete).length;
    return { done, total: fieldList.length, remaining: fieldList.length - done };
  }, [fieldsQuery.data?.fields]);

  const isBusy = saveFieldResponse.isPending || completeRecipient.isPending;

  const handleComplete = useCallback(async () => {
    try {
      await completeRecipient.mutateAsync({ requestId });
      onCompleted();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "We could not finalize your signature.",
      );
    }
  }, [completeRecipient, onCompleted, onError, requestId]);

  if (fieldsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{documentName}</p>
          {recipientName ? (
            <p className="truncate text-xs text-muted-foreground">{recipientName}</p>
          ) : null}
        </div>
        {fields.length > 0 ? (
          <Badge variant="secondary">
            {progress.remaining > 0
              ? `${progress.remaining} field${progress.remaining === 1 ? "" : "s"} remaining`
              : "All fields completed"}
          </Badge>
        ) : null}
      </header>

      <main className="flex-1 overflow-auto bg-muted/40">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <PdfCanvas
            sourceUrl={session.sourceUrl}
            fields={fields}
            onCommitField={(fieldId, value) => {
              void saveFieldResponse.mutateAsync({ requestId, fieldId, value });
            }}
            onSignatureFieldClick={setSigningField}
          />
        </div>
      </main>

      <footer className="flex h-20 shrink-0 items-center justify-between border-t bg-background px-4 sm:px-6">
        <p className="truncate text-sm text-muted-foreground">
          {isBusy
            ? "Saving your responses…"
            : progress.remaining > 0
              ? `You still have ${progress.remaining} field${progress.remaining === 1 ? "" : "s"} to complete`
              : "Everything looks good. You can review and sign."}
        </p>
        <Button
          onClick={() => void handleComplete()}
          loading={isBusy}
          disabled={progress.remaining > 0}
        >
          <FileSignatureIcon className="h-4 w-4" />
          {progress.remaining > 0 ? "Complete all fields to sign" : "Sign document"}
        </Button>
      </footer>

      {signingField ? (
        <SignaturePadDialog
          field={signingField}
          onCancel={() => setSigningField(null)}
          onConfirm={async (dataUrl) => {
            try {
              const uploaded = await uploadSignatureImageOptions().mutationFn({
                requestId,
                data: dataUrl,
              });
              await saveFieldResponse.mutateAsync({
                requestId,
                fieldId: signingField.id,
                signatureStorageKey: uploaded.signatureStorageKey,
              });
              setSigningField(null);
            } catch (error) {
              onError(
                error instanceof Error
                  ? error.message
                  : "We could not save your signature.",
              );
            }
          }}
        />
      ) : null}
    </div>
  );
}

function PdfCanvas({
  sourceUrl,
  fields,
  onCommitField,
  onSignatureFieldClick,
}: {
  sourceUrl: string;
  fields: RecipientFieldDTO[];
  onCommitField: (fieldId: string, value: unknown) => void;
  onSignatureFieldClick: (field: RecipientFieldDTO) => void;
}) {
  const [numPages, setNumPages] = useState(0);

  const fieldsByPage = useMemo(() => {
    const map = new Map<number, RecipientFieldDTO[]>();
    for (const field of fields) {
      const pageFields = map.get(field.pageNumber) ?? [];
      pageFields.push(field);
      map.set(field.pageNumber, pageFields);
    }
    return map;
  }, [fields]);

  if (numPages > 0 && fieldsByPage.size === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border bg-background">
        <p className="text-sm text-muted-foreground">
          No fields were assigned to you for this document.
        </p>
      </div>
    );
  }

  return (
    <Document
      file={sourceUrl}
      onLoadSuccess={({ numPages: count }) => setNumPages(count)}
      onLoadError={() => toast.error("Could not load the document.")}
      className="flex flex-col items-center gap-6"
    >
      {Array.from({ length: numPages }, (_, i) => (
        <PageFrame
          key={i + 1}
          pageNumber={i + 1}
          sourceUrl={sourceUrl}
          fields={fieldsByPage.get(i + 1) ?? []}
          onCommitField={onCommitField}
          onSignatureFieldClick={onSignatureFieldClick}
        />
      ))}
    </Document>
  );
}

function PageFrame({
  pageNumber,
  sourceUrl,
  fields,
  onCommitField,
  onSignatureFieldClick,
}: {
  pageNumber: number;
  sourceUrl: string;
  fields: RecipientFieldDTO[];
  onCommitField: (fieldId: string, value: unknown) => void;
  onSignatureFieldClick: (field: RecipientFieldDTO) => void;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border bg-white shadow-sm">
      <Page
        key={`${sourceUrl}-${pageNumber}`}
        pageNumber={pageNumber}
        renderAnnotationLayer={false}
        renderTextLayer={false}
        width={768}
      />
      {fields.map((field) => (
        <FieldOverlay
          key={field.id}
          field={field}
          onCommitField={onCommitField}
          onSignatureFieldClick={onSignatureFieldClick}
        />
      ))}
    </div>
  );
}

function FieldOverlay({
  field,
  onCommitField,
  onSignatureFieldClick,
}: {
  field: RecipientFieldDTO;
  onCommitField: (fieldId: string, value: unknown) => void;
  onSignatureFieldClick: (field: RecipientFieldDTO) => void;
}) {
  const commit = useCallback(
    (value: unknown) => onCommitField(field.id, value),
    [field.id, onCommitField],
  );

  return (
    <div
      className={`absolute flex items-center overflow-hidden rounded border-2 ${
        field.complete ? "opacity-80" : ""
      } ${FIELD_ACCENTS[field.type]}`}
      style={{
        left: `${field.x * 100}%`,
        top: `${field.y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
      }}
      title={field.label ?? FIELD_LABELS[field.type]}
    >
      {field.complete ? (
        <div className="flex w-full items-center justify-center gap-1 overflow-hidden">
          <CheckIcon className="h-3 w-3 shrink-0" />
          <span className="truncate text-[10px] font-medium opacity-80">
            {field.type === "SIGNATURE" || field.type === "INITIALS"
              ? "Signed"
              : String(field.value ?? "Done")}
          </span>
        </div>
      ) : SIGNATURE_TYPES.has(field.type) ? (
        <button
          type="button"
          onClick={() => onSignatureFieldClick(field)}
          className="flex h-full w-full cursor-pointer items-center justify-center gap-1 text-[10px] font-medium"
        >
          <PenLineIcon className="h-3 w-3 shrink-0" />
          {field.type === "INITIALS" ? "Initial" : "Sign"}
        </button>
      ) : TEXT_TYPES.has(field.type) ? (
        <input
          type={field.type === "NUMBER" ? "number" : field.type === "EMAIL" ? "email" : "text"}
          defaultValue={
            typeof field.value === "string" && field.value !== "signed"
              ? field.value
              : ""
          }
          onBlur={(event) => commit(event.target.value)}
          placeholder={field.placeholder ?? ""}
          className="h-full w-full bg-transparent px-1.5 text-xs outline-none"
        />
      ) : field.type === "CHECKBOX" ? (
        <button
          type="button"
          onClick={() => commit(field.value === true ? false : true)}
          className="flex h-full w-full cursor-pointer items-center justify-center"
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
              field.value === true ? "border-black bg-black text-white" : "border-black/30"
            }`}
          >
            {field.value === true ? <CheckIcon className="h-3 w-3" /> : null}
          </span>
        </button>
      ) : (
        <ChoiceField field={field} onCommit={commit} />
      )}
    </div>
  );
}

function ChoiceField({
  field,
  onCommit,
}: {
  field: RecipientFieldDTO;
  onCommit: (value: unknown) => void;
}) {
  const options = fieldOptions(field);
  const current = String(field.value ?? "");

  if (field.type === "RADIO") {
    return (
      <select
        defaultValue={current}
        onChange={(event) => onCommit(event.target.value)}
        className="h-full w-full cursor-pointer bg-transparent px-1 text-xs outline-none"
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="relative h-full w-full">
      <select
        defaultValue={current}
        onChange={(event) => onCommit(event.target.value)}
        className="h-full w-full cursor-pointer appearance-none bg-transparent px-1 pr-5 text-xs outline-none"
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2" />
    </div>
  );
}