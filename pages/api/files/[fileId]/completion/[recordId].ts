import type { NextApiRequest, NextApiResponse } from "next";

import {
  requireFileAccess,
  sendAuthorizationError,
} from "@/modules/files/server/authorization";
import { toCompletionRecordDetailDTO } from "@/modules/completion/application/serialize";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const fileId = String(req.query.fileId || "");
  const recordId = String(req.query.recordId || "");

  try {
    await requireFileAccess(req, res, fileId);

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const record = await prisma.dossierCompletionRecord.findFirst({
      where: { id: recordId, dossierFileId: fileId },
      include: { artifacts: { orderBy: { createdAt: "asc" } } },
    });

    if (!record) {
      return res.status(404).json({ error: "Completion record not found" });
    }

    return res.status(200).json(toCompletionRecordDetailDTO(record));
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
