// POST /api/teams/:teamId/signature-requests
// Creates a signature request DRAFT for a document + recipients (team member).
// The sender then opens the full-page editor to place fields and sends.

import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireTeamMember } from "@/shared/utils/api/require-team-member";
import { errorhandler } from "@/shared/utils/errorHandler";
import { createDraft } from "@/features/signing/application/create-draft";
import { createSigningContext } from "@/features/signing/application/context";
import { isDossierSigningEnabled } from "@/features/signing/config";
import { signatureRecipientsInputSchema } from "@/features/signing/domain/recipient-validation";

const bodySchema = z.object({
  documentId: z.string().min(1),
  recipients: signatureRecipientsInputSchema,
  expiresAt: z
    .union([z.string(), z.date()])
    .nullish()
    .transform((val) => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }),
  dossierFileId: z.string().nullish(),
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
      console.error(
        "[signature-requests.POST] Validation error:",
        JSON.stringify(parsed.error.format(), null, 2),
        "Body was:",
        req.body,
      );
      return res.status(400).json({
        message: "Invalid request payload.",
        errors: parsed.error.format(),
      });
    }

    const result = await createDraft(createSigningContext(), {
      actor: { userId: user.id, teamId },
      documentId: parsed.data.documentId,
      recipients: parsed.data.recipients,
      expiresAt: parsed.data.expiresAt,
      dossierFileId: parsed.data.dossierFileId,
    });

    return res.status(201).json(result);
  } catch (error) {
    return errorhandler(error, res);
  }
}
