// POST /api/teams/:teamId/signature-requests
// Creates a signature request for a READY template + recipients (team member).

import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireTeamMember } from "@/lib/api/require-team-member";
import { errorhandler } from "@/lib/errorHandler";
import { createRequest } from "@/modules/signing/application/create-request";
import { createSigningContext } from "@/modules/signing/application/context";
import { isDossierSigningEnabled } from "@/modules/signing/config";
import { signatureRecipientsInputSchema } from "@/modules/signing/domain/recipient-validation";

const bodySchema = z.object({
  documentId: z.string().min(1),
  templateId: z.string().min(1),
  recipients: signatureRecipientsInputSchema,
  expiresAt: z.string().datetime().nullable().optional(),
});

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

  const { teamId } = req.query as { teamId: string };
  const user = await requireTeamMember(req, res, teamId);
  if (!user) return;

  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request payload." });
    }

    const result = await createRequest(createSigningContext(), {
      actor: { userId: user.id, teamId },
      documentId: parsed.data.documentId,
      templateId: parsed.data.templateId,
      recipients: parsed.data.recipients,
      expiresAt: parsed.data.expiresAt,
    });

    return res.status(201).json(result);
  } catch (error) {
    return errorhandler(error, res);
  }
}
