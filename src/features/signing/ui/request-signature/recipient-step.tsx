// Step 1 — who signs. Collects recipient emails (and optional names). Nothing
// is persisted here; the draft lives in the request-signature context.

import { useMemo, useState } from "react";

import { PlusIcon, TrashIcon, UserPlusIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/utils";

import {
  EXPIRATION_OPTIONS,
  expirationToIso,
  type RecipientDraft,
} from "./types";

const MAX_RECIPIENTS = 20;

export function RecipientStep({
  recipients,
  onChange,
  expiresAt,
  onExpiresAtChange,
  onNext,
}: {
  recipients: RecipientDraft[];
  onChange: (recipients: RecipientDraft[]) => void;
  expiresAt: string | null;
  onExpiresAtChange: (expiresAt: string | null) => void;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const emailValid = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const update = (index: number, patch: Partial<RecipientDraft>) => {
    const next = recipients.map((recipient, i) =>
      i === index ? { ...recipient, ...patch } : recipient,
    );
    onChange(next);
  };

  const addRecipient = () => {
    setError(null);
    if (recipients.length >= MAX_RECIPIENTS) {
      setError(`You can add up to ${MAX_RECIPIENTS} recipients.`);
      return;
    }
    onChange([
      ...recipients,
      { name: "", email: "", signingOrder: recipients.length + 1 },
    ]);
  };

  const removeRecipient = (index: number) => {
    const remaining = recipients
      .filter((_, i) => i !== index)
      .map((recipient, i) => ({ ...recipient, signingOrder: i + 1 }));
    onChange(remaining);
  };

  const canContinue = useMemo(() => {
    if (recipients.length === 0) return false;
    const emails = recipients.map((r) => r.email.trim().toLowerCase());
    return (
      emails.every((email) => emailValid(email)) &&
      new Set(emails).size === emails.length
    );
  }, [recipients]);

  const handleContinue = () => {
    const emails = recipients.map((r) => r.email.trim().toLowerCase());
    if (!emails.every(emailValid)) {
      setError("Please enter a valid email for every recipient.");
      return;
    }
    if (new Set(emails).size !== emails.length) {
      setError("Every recipient needs a unique email address.");
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {recipients.map((recipient, index) => (
          <div
            key={index}
            className="flex items-end gap-2 rounded-lg border p-3"
          >
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`signer-name-${index}`}>Name (optional)</Label>
                <Input
                  id={`signer-name-${index}`}
                  value={recipient.name ?? ""}
                  onChange={(e) => update(index, { name: e.target.value })}
                  placeholder="Ada Lovelace"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`signer-email-${index}`}>Email</Label>
                <Input
                  id={`signer-email-${index}`}
                  type="email"
                  value={recipient.email}
                  onChange={(e) => update(index, { email: e.target.value })}
                  placeholder="ada@example.com"
                  className={cn(
                    recipient.email &&
                      !emailValid(recipient.email.trim()) &&
                      "border-destructive",
                  )}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove signer ${index + 1}`}
              disabled={recipients.length === 1}
              onClick={() => removeRecipient(index)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRecipient}
          disabled={recipients.length >= MAX_RECIPIENTS}
        >
          <PlusIcon className="h-4 w-4" />
          Add recipient
        </Button>
        <div className="text-xs text-muted-foreground">
          {recipients.length} of {MAX_RECIPIENTS}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor="signing-expiration" className="shrink-0">
          Request expires
        </Label>
        <select
          id="signing-expiration"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          value={expirationIsoToKey(expiresAt) ?? ""}
          onChange={(e) => onExpiresAtChange(expirationToIso(e.target.value))}
        >
          {EXPIRATION_OPTIONS.map((option) => (
            <option key={option.label} value={option.value ?? ""}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={handleContinue} disabled={!canContinue}>
          <UserPlusIcon className="h-4 w-4" />
          Continue to prepare document
        </Button>
      </div>
    </div>
  );
}

function expirationIsoToKey(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.round(
    (new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return null;
  if (days <= 7) return "7";
  if (days <= 14) return "14";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  return null;
}
