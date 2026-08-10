// GET /api/signature-requests/:requestId
// Public, recipient-facing request info for the signing page: status gates +
// document to render. Scoped by requestId only; never exposes recipients.

import { NextApiRequest, NextApiResponse } from "next";

import { errorhandler } from "@/lib/errorHandler";
import { createSigningContext } from "@/modules/signing/application/context";
import { getPublicRequest } from "@/modules/signing/application/get-public-request";
import { isDossierSigningEnabled } from "@/modules/signing/config";

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

  try {
    const request = await getPublicRequest(createSigningContext(), {
      requestId,
    });
    return res.status(200).json({ request });
  } catch (error) {
    return errorhandler(error, res);
  }
}
