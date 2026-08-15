// Step 3 — final review before the request is created and sent.

import { ChevronLeftIcon, FileSignatureIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";

import type { RecipientDraft } from "./types";

export function ReviewStep({
  documentName,
  recipients,
  expiresAt,
  isCreating,
  onBack,
  onCreate,
}: {
  documentName: string;
  recipients: RecipientDraft[];
  expiresAt: string | null;
  isCreating: boolean;
  onBack: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-lg border p-4">
        <Label>Document</Label>
        <p className="text-sm font-medium">{documentName}</p>
      </div>

      <div className="space-y-1 rounded-lg border p-4">
        <Label>Signers</Label>
        <ul className="mt-1 space-y-1">
          {recipients.map((recipient, index) => (
            <li
              key={index}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                {recipient.signingOrder}
              </span>
              <span className="truncate">
                {recipient.name?.trim() || "Unnamed signer"}
              </span>
              <span className="truncate">{recipient.email}</span>
            </li>
          ))}
        </ul>
      </div>

      {expiresAt ? (
        <div className="space-y-1 rounded-lg border p-4">
          <Label>Expiration</Label>
          <p className="text-sm text-muted-foreground">
            {new Date(expiresAt).toLocaleString()}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={isCreating}>
          <ChevronLeftIcon className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onCreate} loading={isCreating}>
          <FileSignatureIcon className="h-4 w-4" />
          {isCreating ? "Creating request…" : "Create signature request"}
        </Button>
      </div>
    </div>
  );
}
