// POST /api/teams/:teamId/signature-templates/:templateId/editor-session
// Returns the field-authoring embed session (contract-only: presignToken is
// null until the provider integration lands).

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/shared/utils/api/require-team-member";
import { errorhandler } from "@/shared/utils/errorHandler";
import { createEditorSession } from "@/features/signing/application/create-editor-session";
import { createSigningContext } from "@/features/signing/application/context";
import { isDossierSigningEnabled } from "@/features/signing/config";

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

  const { teamId, templateId } = req.query as {
    teamId: string;
    templateId: string;
  };
  const user = await requireTeamMember(req, res, teamId);
  if (!user) return;

  try {
    const session = await createEditorSession(createSigningContext(), {
      teamId,
      templateId,
    });
    return res.status(200).json({ session });
  } catch (error) {
    return errorhandler(error, res);
  }
}
