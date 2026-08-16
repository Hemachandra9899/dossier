// POST /api/signature-requests/:requestId/complete
// Recipient-facing: the recipient's final "Sign / Complete" action. Verifies
// all required fields are complete, marks the recipient SIGNED, and either
// moves the request to PARTIALLY_SIGNED or (when the last recipient signs)
// finalizes the signed PDF and marks the request COMPLETED. Access is proven
// by the HttpOnly recipient-access cookie.

import { NextApiRequest, NextApiResponse } from "next";

import { errorhandler } from "@/shared/utils/errorHandler";
import { createSigningContext } from "@/features/signing/application/context";
import { completeRecipient } from "@/features/signing/application/complete-recipient";
import { isDossierSigningEnabled } from "@/features/signing/config";
import { readRecipientAccessFromCookies } from "@/features/signing/domain/recipient-access-token";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  if (!isDossierSigningEnabled) {
    return res.status(404).end();
  }

  const { requestId } = req.query as { requestId: string };

  const access = readRecipientAccessFromCookies(req.headers.cookie, {
    signatureRequestId: requestId,
  });
  if (!access.ok) {
    return res.status(404).end();
  }

  try {
    const request = await completeRecipient(createSigningContext(), {
      requestId,
      recipientId: access.recipientId,
    });
    return res.status(200).json({ request });
  } catch (error) {
    return errorhandler(error, res);
  }
}