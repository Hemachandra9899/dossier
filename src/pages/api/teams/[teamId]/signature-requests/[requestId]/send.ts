// POST /api/teams/:teamId/signature-requests/:requestId/send
// Server-validates the request's fields against the provider envelope, mints
// per-recipient signing documents and dispatches invitations (team member).
// Field-validation failures return 409 with a machine-readable code.

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/shared/utils/api/require-team-member";
import { errorhandler } from "@/shared/utils/errorHandler";
import { createSigningContext } from "@/features/signing/application/context";
import { sendRequest } from "@/features/signing/application/send-request";
import { isDossierSigningEnabled } from "@/features/signing/config";
import { SigningSendError } from "@/features/signing/domain/signing-errors";

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
    const result = await sendRequest(createSigningContext(), {
      actor: { userId: user.id, teamId },
      requestId,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SigningSendError) {
      return res.status(409).json({
        error: error.code,
        message: error.message,
        recipients: error.recipients,
      });
    }
    return errorhandler(error, res);
  }
}
