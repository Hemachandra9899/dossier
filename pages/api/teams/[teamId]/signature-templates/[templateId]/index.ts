// GET /api/teams/:teamId/signature-templates/:templateId
// Returns a signature template (team member).

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/lib/api/require-team-member";
import { errorhandler } from "@/lib/errorHandler";
import { createSigningContext } from "@/modules/signing/application/context";
import { getTemplate } from "@/modules/signing/application/get-template";
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

  const { teamId, templateId } = req.query as {
    teamId: string;
    templateId: string;
  };
  const user = await requireTeamMember(req, res, teamId);
  if (!user) return;

  try {
    const template = await getTemplate(createSigningContext(), {
      teamId,
      templateId,
    });
    return res.status(200).json({ template });
  } catch (error) {
    return errorhandler(error, res);
  }
}
