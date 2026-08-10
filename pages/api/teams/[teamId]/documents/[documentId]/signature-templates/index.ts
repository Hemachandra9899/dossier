// POST /api/teams/:teamId/documents/:documentId/signature-templates
// Creates a local-only signature template for a PDF document (team member).

import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireTeamMember } from "@/lib/api/require-team-member";
import { errorhandler } from "@/lib/errorHandler";
import { createSigningContext } from "@/modules/signing/application/context";
import { createTemplate } from "@/modules/signing/application/create-template";
import { isDossierSigningEnabled } from "@/modules/signing/config";

const bodySchema = z.object({
  name: z.string().min(1).max(150),
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

  const { teamId, documentId } = req.query as {
    teamId: string;
    documentId: string;
  };
  const user = await requireTeamMember(req, res, teamId);
  if (!user) return;

  try {
    const input = bodySchema.parse(req.body);
    const result = await createTemplate(createSigningContext(), {
      actor: { userId: user.id, teamId },
      documentId,
      name: input.name,
    });
    return res.status(201).json(result);
  } catch (error) {
    return errorhandler(error, res);
  }
}
