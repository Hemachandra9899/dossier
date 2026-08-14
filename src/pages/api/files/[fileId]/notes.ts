import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@/lib/prisma";
import {
  requireFileAccess,
  sendAuthorizationError,
} from "@/modules/files/server/authorization";

const Schema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const fileId = String(req.query.fileId || "");

  try {
    const { userId } = await requireFileAccess(req, res, fileId);

    if (req.method === "POST") {
      const parsed = Schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid note" });
      }

      const note = await prisma.$transaction(async (tx) => {
        const created = await tx.dossierFileNote.create({
          data: {
            fileId,
            createdById: userId,
            body: parsed.data.body,
          },
        });

        await tx.dossierFileActivity.create({
          data: {
            fileId,
            type: "NOTE_ADDED",
            actorUserId: userId,
            metadata: {
              noteId: created.id,
            },
          },
        });

        return created;
      });

      return res.status(201).json({ note });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
