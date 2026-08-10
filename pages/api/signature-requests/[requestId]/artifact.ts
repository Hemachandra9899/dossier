// GET /api/signature-requests/:requestId/artifact
// Public, recipient-facing signed-artifact download. Returns a presigned
// download URL once the artifact has been mirrored, otherwise "pending".

import { NextApiRequest, NextApiResponse } from "next";

import { errorhandler } from "@/lib/errorHandler";
import { createSigningContext } from "@/modules/signing/application/context";
import { getPublicSignedArtifact } from "@/modules/signing/application/get-public-signed-artifact";
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
    const artifact = await getPublicSignedArtifact(createSigningContext(), {
      requestId,
    });
    return res.status(200).json(artifact);
  } catch (error) {
    return errorhandler(error, res);
  }
}
