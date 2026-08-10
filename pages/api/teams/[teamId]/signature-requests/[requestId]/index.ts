// GET /api/teams/:teamId/signature-requests/:requestId
// Returns a signature request with its recipients (team member).

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/lib/api/require-team-member";
import { errorhandler } from "@/lib/errorHandler";
import { createSigningContext } from "@/modules/signing/application/context";
import { getRequest } from "@/modules/signing/application/get-request";
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

  const { teamId, requestId } = req.query as {
    teamId: string;
    requestId: string;
  };
  const user = await requireTeamMember(req, res, teamId);
  if (!user) return;

  try {
    const request = await getRequest(createSigningContext(), {
      teamId,
      requestId,
    });
    return res.status(200).json({ request });
  } catch (error) {
    return errorhandler(error, res);
  }
}
