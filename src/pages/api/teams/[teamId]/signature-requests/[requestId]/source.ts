// GET /api/teams/:teamId/signature-requests/:requestId/source
// Returns a short-lived signed URL for the exact PDF version this request is
// pinned to. Used by both the sender editor and the recipient signing view.

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/shared/utils/api/require-team-member";
import { errorhandler } from "@/shared/utils/errorHandler";
import { createSigningContext } from "@/features/signing/application/context";
import { getSourcePdf } from "@/features/signing/application/get-source-pdf";
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
    const result = await getSourcePdf(createSigningContext(), {
      teamId,
      requestId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return errorhandler(error, res);
  }
}
