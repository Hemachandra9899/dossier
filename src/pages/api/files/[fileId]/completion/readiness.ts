import type { NextApiRequest, NextApiResponse } from "next";

import {
  requireFileAccess,
  sendAuthorizationError,
} from "@/features/files/server/authorization";
import {
  CompletionReadinessFileNotFoundError,
  getCompletionReadiness,
} from "@/features/completion/application/get-completion-readiness";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const fileId = String(req.query.fileId || "");

  try {
    await requireFileAccess(req, res, fileId);

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const readiness = await getCompletionReadiness(fileId);

    return res.status(200).json(readiness);
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    if (error instanceof CompletionReadinessFileNotFoundError) {
      return res.status(404).json({ error: "File not found" });
    }
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
