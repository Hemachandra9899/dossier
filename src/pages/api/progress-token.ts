import { NextApiRequest, NextApiResponse } from "next";

import { generateTriggerPublicAccessToken } from "@/shared/utils/utils/generate-trigger-auth-token";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { documentVersionId } = req.query;

  if (!documentVersionId || typeof documentVersionId !== "string") {
    return res.status(400).json({ error: "Document version ID is required" });
  }

  try {
    if (!process.env.TRIGGER_SECRET_KEY) {
      return res.status(200).json({ publicAccessToken: null });
    }
    const publicAccessToken = await generateTriggerPublicAccessToken(
      `version:${documentVersionId}`,
    );
    return res.status(200).json({ publicAccessToken });
  } catch (error) {
    return res.status(200).json({ publicAccessToken: null });
  }
}
