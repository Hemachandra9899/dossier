// Renders a human-readable status chip for a SignatureRequest. Used in the
// wizard summary, the document action, and any future request list.

import type { SignatureRequestStatus } from "@/modules/signing/domain/signature-request";

import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<SignatureRequestStatus, string> = {
  DRAFT: "Draft",
  PREPARING: "Preparing",
  READY: "Ready",
  SENT: "Awaiting signature",
  VIEWED: "Awaiting signature",
  SIGNING: "Awaiting signature",
  PARTIALLY_SIGNED: "Partially signed",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

const STATUS_VARIANTS: Record<
  SignatureRequestStatus,
  "secondary" | "email" | "preview" | "download" | "time" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  PREPARING: "secondary",
  READY: "outline",
  SENT: "email",
  VIEWED: "email",
  SIGNING: "email",
  PARTIALLY_SIGNED: "download",
  COMPLETED: "preview",
  DECLINED: "destructive",
  EXPIRED: "time",
  CANCELLED: "secondary",
  FAILED: "destructive",
};

export function SignatureStatusBadge({
  status,
  className,
}: {
  status: SignatureRequestStatus;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "secondary"} className={className}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
