// Step 4 — request created. Copy the per-recipient signing link and close.

import { CheckCircle2Icon, CopyIcon, LinkIcon } from "lucide-react";

import type { SignatureRequestStatus } from "@/features/signing/domain/signature-request";

import { Button } from "@/shared/ui/button";
import LoadingSpinner from "@/shared/ui/loading-spinner";
import { useCopyToClipboard } from "@/shared/utils/utils/use-copy-to-clipboard";

import { SignatureStatusBadge } from "../signature-status-badge";
import { useRecipientSigningUrl } from "../use-recipient-signing-url";

export function SuccessStep({
  teamId,
  requestId,
  firstRecipientId,
  status,
  onClose,
}: {
  teamId: string;
  requestId: string;
  firstRecipientId: string | null;
  status: SignatureRequestStatus;
  onClose: () => void;
}) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({});
  const { url: signingUrl, isLoading, error } = useRecipientSigningUrl({
    teamId,
    requestId,
    recipientId: firstRecipientId,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <CheckCircle2Icon className="h-12 w-12 text-green-600 dark:text-green-500" />
        <h3 className="text-lg font-semibold">Signature request created</h3>
        <p className="text-sm text-muted-foreground">
          Share the link below with your first signer. They can sign and pass
          the document on.
        </p>
        <SignatureStatusBadge status={status} />
      </div>

      {signingUrl ? (
        <div className="flex items-center gap-2 rounded-lg border p-2">
          <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <code className="min-w-0 flex-1 truncate text-xs">{signingUrl}</code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              copyToClipboard(signingUrl, "Signing link copied to clipboard.");
            }}
          >
            {isCopied ? (
              <CheckCircle2Icon className="h-4 w-4" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
            {isCopied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : firstRecipientId ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border p-2 text-sm text-muted-foreground">
          {isLoading ? (
            <>
              <LoadingSpinner className="h-4 w-4" />
              Preparing signing link…
            </>
          ) : (
            error ?? "Could not prepare the signing link."
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This request has no recipients.
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
