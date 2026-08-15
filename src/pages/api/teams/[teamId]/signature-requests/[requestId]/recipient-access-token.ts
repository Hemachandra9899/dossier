// GET /api/teams/:teamId/signature-requests/:requestId/recipient-access-token
// Sender-facing minting of the per-recipient invitation token used to build the
// shareable signing URL (team member only). The token is short-lived, capped by
// the request's own expiry, and verified by HMAC at every public endpoint.

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/shared/utils/api/require-team-member";
import { errorhandler } from "@/shared/utils/errorHandler";
import { createSigningContext } from "@/features/signing/application/context";
import { getRecipientAccessToken } from "@/features/signing/application/get-recipient-access-token";
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

  const recipientId =
    typeof req.query.recipientId === "string" ? req.query.recipientId : "";

  try {
    const access = await getRecipientAccessToken(createSigningContext(), {
      teamId,
      requestId,
      recipientId,
    });
    return res.status(200).json({ access });
  } catch (error) {
    return errorhandler(error, res);
  }
}
