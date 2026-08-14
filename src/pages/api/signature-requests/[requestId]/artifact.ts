// GET /api/signature-requests/:requestId/artifact
// Access-proofed, recipient-safe signed-artifact download. Returns a presigned
// download URL once the artifact has been mirrored, otherwise "pending".

import { NextApiRequest, NextApiResponse } from "next";

import { errorhandler } from "@/lib/errorHandler";
import { createSigningContext } from "@/modules/signing/application/context";
import { getPublicSignedArtifact } from "@/modules/signing/application/get-public-signed-artifact";
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

  res.setHeader("Cache-Control", "private, no-store");

  try {
    const artifact = await getPublicSignedArtifact(createSigningContext(), {
      requestId,
      recipientId: access.recipientId,
    });
    return res.status(200).json(artifact);
  } catch (error) {
    return errorhandler(error, res);
  }
}
