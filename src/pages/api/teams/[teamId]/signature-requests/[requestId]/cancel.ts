// POST /api/teams/:teamId/signature-requests/:requestId/cancel
// Cancels a non-terminal signature request (team member; idempotent).

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/lib/api/require-team-member";
import { errorhandler } from "@/lib/errorHandler";
import { cancelRequest } from "@/modules/signing/application/cancel-request";
import { createSigningContext } from "@/modules/signing/application/context";
import { isDossierSigningEnabled } from "@/modules/signing/config";

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

  const { teamId, requestId } = req.query as {
    teamId: string;
    requestId: string;
  };
  const user = await requireTeamMember(req, res, teamId);
  if (!user) return;

  try {
    const request = await cancelRequest(createSigningContext(), {
      teamId,
      requestId,
    });
    return res.status(200).json({ request });
  } catch (error) {
    return errorhandler(error, res);
  }
}
