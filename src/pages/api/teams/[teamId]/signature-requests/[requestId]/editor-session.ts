// POST /api/teams/:teamId/signature-requests/:requestId/editor-session
// Returns the field-authoring embed session for a request's envelope (team
// member). Opening the editor moves a DRAFT request into PREPARING.

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/shared/utils/api/require-team-member";
import { errorhandler } from "@/shared/utils/errorHandler";
import { createRequestEditorSession } from "@/features/signing/application/create-request-editor-session";
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

  const { teamId, requestId } = req.query as {
    teamId: string;
    requestId: string;
  };
  const user = await requireTeamMember(req, res, teamId);
  if (!user) return;

  try {
    const session = await createRequestEditorSession(createSigningContext(), {
      teamId,
      requestId,
    });
    return res.status(200).json({ session });
  } catch (error) {
    return errorhandler(error, res);
  }
}
