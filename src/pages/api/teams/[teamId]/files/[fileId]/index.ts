import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@/platform/db";
import {
  requireFileAccess,
  sendAuthorizationError,
} from "@/features/files/server/authorization";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const teamId = String(req.query.teamId || "");
  const fileId = String(req.query.fileId || "");

  try {
    const { file: access } = await requireFileAccess(req, res, fileId);

    if (access.teamId !== teamId) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = await prisma.dossierFile.findUnique({
      where: { id: fileId },

      select: {
        id: true,
        title: true,
        clientName: true,
        clientEmail: true,
        reference: true,
        caseType: true,

        status: true,
        priority: true,

        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },

        dueAt: true,
        requiresSignature: true,

        createdAt: true,
        completedAt: true,
      },
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    return res.status(200).json(file);
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}