import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import {
  requireTeamMembership,
  sendAuthorizationError,
} from "@/modules/files/server/authorization";
import { createDossierFile } from "@/modules/files/application/create-file";
import { getFilesBoard } from "@/modules/files/application/get-files-board";

const CreateFileSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  clientName: z.string().trim().max(200).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  reference: z.string().trim().max(100).optional(),
  caseType: z.string().trim().max(100).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  ownerId: z.string().optional(),
  dueAt: z.string().datetime().optional().nullable(),
  requiresSignature: z.boolean().optional(),
  templateId: z.string().optional().nullable(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method === "GET") {
      const teamId = String(req.query.teamId || "");
      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      const { userId, membership } = await requireTeamMembership(
        req,
        res,
        teamId,
      );

      const files = await getFilesBoard({
        teamId,
        userId,
        role: membership.role,
      });

      return res.status(200).json({ files });
    }

    if (req.method === "POST") {
      const parsed = CreateFileSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          issues: parsed.error.flatten(),
        });
      }

      const { userId } = await requireTeamMembership(
        req,
        res,
        parsed.data.teamId,
      );

      const file = await createDossierFile({
        teamId: parsed.data.teamId,
        userId,
        title: parsed.data.title,
        clientName: parsed.data.clientName,
        clientEmail: parsed.data.clientEmail || null,
        reference: parsed.data.reference,
        caseType: parsed.data.caseType,
        priority: parsed.data.priority,
        ownerId: parsed.data.ownerId,
        dueAt: parsed.data.dueAt
          ? new Date(parsed.data.dueAt)
          : null,
        requiresSignature: parsed.data.requiresSignature,
        templateId: parsed.data.templateId,
      });

      return res.status(201).json({ file });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
