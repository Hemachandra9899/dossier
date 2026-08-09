// Central normalization of Documenso events into the Dossier status
// vocabulary. Event names below are pinned to Documenso 2.16.0 — re-verify
// against the checked-out Documenso fork before changing them.

import type { SignatureRequestStatus } from "../../domain/signature-request";
import type { SignatureRecipientStatus } from "../../domain/signature-recipient";

export const DOCUMENSO_EVENT_SIGNED = "DOCUMENT_SIGNED";
export const DOCUMENSO_EVENT_COMPLETED = "DOCUMENT_COMPLETED";
export const DOCUMENSO_EVENT_REJECTED = "DOCUMENT_REJECTED";
export const DOCUMENSO_EVENT_CANCELLED = "DOCUMENT_CANCELLED";
export const DOCUMENSO_EVENT_RECIPIENT_EXPIRED = "RECIPIENT_EXPIRED";
export const DOCUMENSO_EVENT_DOCUMENT_OPENED = "DOCUMENT_OPENED";

export const DOCUMENSO_SIGNING_EVENTS = new Set<string>([
  DOCUMENSO_EVENT_SIGNED,
  DOCUMENSO_EVENT_COMPLETED,
  DOCUMENSO_EVENT_REJECTED,
  DOCUMENSO_EVENT_CANCELLED,
  DOCUMENSO_EVENT_RECIPIENT_EXPIRED,
]);

export function mapDocumensoEventToStatus(
  event: string,
): SignatureRequestStatus | null {
  switch (event) {
    case DOCUMENSO_EVENT_SIGNED:
      return "PARTIALLY_SIGNED";

    case DOCUMENSO_EVENT_COMPLETED:
      return "COMPLETED";

    case DOCUMENSO_EVENT_REJECTED:
      return "DECLINED";

    case DOCUMENSO_EVENT_CANCELLED:
      return "CANCELLED";

    case DOCUMENSO_EVENT_RECIPIENT_EXPIRED:
      return "EXPIRED";

    default:
      return null;
  }
}

export function mapDocumensoRecipientStatusToStatus(
  status?: string | null,
): SignatureRecipientStatus | null {
  switch (status) {
    case "SIGNED":
      return "SIGNED";

    case "REJECTED":
      return "DECLINED";

    case "EXPIRED":
      return "EXPIRED";

    case "OPENED":
    case "VIEWED":
      return "VIEWED";

    case "IN_PROGRESS":
    case "DRAFT":
      return "SIGNING";

    default:
      return null;
  }
}
