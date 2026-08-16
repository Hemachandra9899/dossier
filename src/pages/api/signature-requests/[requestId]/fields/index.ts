// GET /api/signature-requests/:requestId/fields
// Recipient-facing: returns ONLY the fields assigned to the caller's recipient.
// Access is proven by the HttpOnly recipient-access cookie. Never returns
// recipient ids, other recipients' fields or storage keys for signatures.

import { NextApiRequest, NextApiResponse } from "next";

import { errorhandler } from "@/shared/utils/errorHandler";
import { createSigningContext } from "@/features/signing/application/context";
import { isDossierSigningEnabled } from "@/features/signing/config";
import { readRecipientAccessFromCookies } from "@/features/signing/domain/recipient-access-token";
import { toRecipientFieldDTO } from "@/features/signing/domain/signature-field";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
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

  res.setHeader("Cache-Control", "private, no-store");

  try {
    const ctx = createSigningContext();
    const fields = await ctx.fields.listByRequestAndRecipient(
      requestId,
      access.recipientId,
    );
    return res
      .status(200)
      .json({ fields: fields.map((field) => toRecipientFieldDTO(field)) });
  } catch (error) {
    return errorhandler(error, res);
  }
}