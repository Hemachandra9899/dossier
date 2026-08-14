import type { NextApiRequest, NextApiResponse } from "next";
import {
  requireTeamMembership,
  sendAuthorizationError,
} from "@/modules/files/server/authorization";
import { getDossierFileTemplates } from "@/modules/files/application/get-templates";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const teamId = String(req.query.teamId || "");
  if (!teamId) {
    return res.status(400).json({ error: "teamId is required" });
  }

  try {
    await requireTeamMembership(req, res, teamId);

    const templates = await getDossierFileTemplates(teamId);
    return res.status(200).json({ templates });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
