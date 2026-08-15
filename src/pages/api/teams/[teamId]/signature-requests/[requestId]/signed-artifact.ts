// GET /api/teams/:teamId/signature-requests/:requestId/signed-artifact
// Returns the mirrored signed artifact, or a "pending" state (team member).

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/shared/utils/api/require-team-member";
import { errorhandler } from "@/shared/utils/errorHandler";
import { createSigningContext } from "@/features/signing/application/context";
import { getSignedArtifact } from "@/features/signing/application/get-signed-artifact";
import { isDossierSigningEnabled } from "@/features/signing/config";

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

  const { teamId, requestId } = req.query as {
    teamId: string;
    requestId: string;
  };
  const user = await requireTeamMember(req, res, teamId);
  if (!user) return;

  try {
    const artifact = await getSignedArtifact(createSigningContext(), {
      teamId,
      requestId,
    });
    return res.status(200).json(artifact);
  } catch (error) {
    return errorhandler(error, res);
  }
}
