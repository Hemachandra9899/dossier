// POST /api/teams/:teamId/signature-requests/:requestId/remind
// Sends a signature request reminder to a recipient (team member only).

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/lib/api/require-team-member";
import { errorhandler } from "@/lib/errorHandler";
import { remindRequest } from "@/modules/signing/application/remind-request";
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

  const recipientId = typeof req.body?.recipientId === "string" ? req.body.recipientId : "";
  if (!recipientId) {
    return res.status(400).json({ message: "recipientId is required in request body" });
  }

  try {
    await remindRequest(createSigningContext(), {
      teamId,
      requestId,
      recipientId,
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return errorhandler(error, res);
  }
}
