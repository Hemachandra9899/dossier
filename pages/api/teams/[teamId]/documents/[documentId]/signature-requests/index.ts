// GET /api/teams/:teamId/documents/:documentId/signature-requests
// Returns the active (non-terminal) signature request for a document, or null
// (team member). The sender UI uses this to show the current request summary
// instead of blindly creating a new request.

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/lib/api/require-team-member";
import { errorhandler } from "@/lib/errorHandler";
import { createSigningContext } from "@/modules/signing/application/context";
import { getActiveRequest } from "@/modules/signing/application/get-active-request";
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

  const { teamId, documentId } = req.query as {
    teamId: string;
    documentId: string;
  };
  const user = await requireTeamMember(req, res, teamId);
  if (!user) return;

  try {
    const request = await getActiveRequest(createSigningContext(), {
      teamId,
      documentId,
    });
    return res.status(200).json({ request });
  } catch (error) {
    return errorhandler(error, res);
  }
}
