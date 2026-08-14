// GET /api/signature-requests/:requestId
// Access-proofed, recipient-safe request info. A requestId is a locator, not
// authorization: the caller must present the HttpOnly recipient-access cookie
// bound to this request. Returns only the minimal recipient-safe DTO.

import { NextApiRequest, NextApiResponse } from "next";

import { errorhandler } from "@/lib/errorHandler";
import { createSigningContext } from "@/modules/signing/application/context";
import { getPublicRequest } from "@/modules/signing/application/get-public-request";
import { isDossierSigningRuntimeEnabled } from "@/modules/signing/config";
import { readRecipientAccessFromCookies } from "@/modules/signing/domain/recipient-access-token";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  if (!isDossierSigningRuntimeEnabled) {
    return res.status(404).end();
  }

  const { requestId } = req.query as { requestId: string };

  // Uniform 404 on missing/invalid proof: never reveal whether a requestId
  // exists, and never treat possession of the id as authorization.
  const access = readRecipientAccessFromCookies(req.headers.cookie, {
    signatureRequestId: requestId,
  });
  if (!access.ok) {
    return res.status(404).end();
  }

  try {
    const request = await getPublicRequest(createSigningContext(), {
      requestId,
      recipientId: access.recipientId,
    });
    return res.status(200).json({ request });
  } catch (error) {
    return errorhandler(error, res);
  }
}
