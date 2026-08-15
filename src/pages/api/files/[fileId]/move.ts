import type { NextApiRequest, NextApiResponse } from "next";
import { DossierFileStatus } from "@prisma/client";
import { z } from "zod";

import prisma from "@/platform/db";
import {
  requireFileAccess,
  sendAuthorizationError,
} from "@/features/files/server/authorization";

const MoveSchema = z.object({
  status: z.nativeEnum(DossierFileStatus),
  position: z.number().finite(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const fileId = String(req.query.fileId || "");

  try {
    const { userId } = await requireFileAccess(req, res, fileId);
    const parsed = MoveSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        issues: parsed.error.flatten(),
      });
    }

    // COMPLETE and ARCHIVED should come from explicit workflow actions,
    // not arbitrary drag/drop.
    if (
      parsed.data.status === "COMPLETE" ||
      parsed.data.status === "ARCHIVED"
    ) {
      return res.status(409).json({
        error:
          "Terminal states cannot be set by board drag and drop.",
      });
    }

    const current = await prisma.dossierFile.findUnique({
      where: { id: fileId },
      select: { status: true },
    });

    if (!current) {
      return res.status(404).json({ error: "File not found" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const file = await tx.dossierFile.update({
        where: { id: fileId },
        data: {
          status: parsed.data.status,
          position: parsed.data.position,
        },
      });

      if (current.status !== parsed.data.status) {
        await tx.dossierFileActivity.create({
          data: {
            fileId,
            type: "STATUS_CHANGED",
            actorUserId: userId,
            metadata: {
              from: current.status,
              to: parsed.data.status,
              source: "BOARD_DRAG",
            },
          },
        });
      }

      return file;
    });

    return res.status(200).json({ file: updated });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
