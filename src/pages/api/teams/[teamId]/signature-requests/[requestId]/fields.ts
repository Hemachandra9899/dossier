// GET/PUT /api/teams/:teamId/signature-requests/:requestId/fields
// GET returns the request's current field layout (team member).
// PUT replaces the full layout in one transaction (upsert incoming, delete
// removed). Only editable request statuses (DRAFT/PREPARING/READY) accept PUT.

import { NextApiRequest, NextApiResponse } from "next";

import { requireTeamMember } from "@/shared/utils/api/require-team-member";
import { errorhandler } from "@/shared/utils/errorHandler";
import { createSigningContext } from "@/features/signing/application/context";
import { saveFields } from "@/features/signing/application/save-fields";
import { isDossierSigningEnabled } from "@/features/signing/config";
import { signatureFieldsInputSchema } from "@/features/signing/domain/signature-field-schema";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", ["GET", "PUT"]);
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

  const ctx = createSigningContext();

  try {
    if (req.method === "GET") {
      const request = await ctx.requests.findByTeamAndIdWithRecipients(
        teamId,
        requestId,
      );
      if (!request) {
        return res.status(404).json({ error: "Signature request not found" });
      }
      const fields = await ctx.fields.listByRequestId(requestId);
      return res.status(200).json({ fields });
    }

    const parsed = signatureFieldsInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid field layout payload.",
        details: parsed.error.flatten(),
      });
    }

    const result = await saveFields(ctx, {
      teamId,
      requestId,
      fields: parsed.data.fields,
    });

    return res.status(200).json(result);
  } catch (error) {
    return errorhandler(error, res);
  }
}
