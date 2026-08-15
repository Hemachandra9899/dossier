import { NextApiRequest, NextApiResponse } from "next";

import { getLimits } from "@/ee/limits/server";
import { authOptions } from "@/shared/utils/auth/auth-options";
import { getServerSession } from "next-auth/next";

import { getFeatureFlags } from "@/shared/utils/featureFlags";
import { CustomUser } from "@/shared/utils/types";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    // GET /api/:teamId/limits
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).end("Unauthorized");
    }

    const { teamId } = req.query as { teamId: string };
    const userId = (session.user as CustomUser).id;

    try {
      const limits = await getLimits({ teamId, userId });
      const featureFlags = await getFeatureFlags({ teamId });
      const conversationsInDataroom =
        featureFlags.conversations || limits.conversationsInDataroom;
      const dataroomUpload = featureFlags.dataroomUpload || limits.dataroomUpload;

      return res.status(200).json({
        ...limits,
        conversationsInDataroom,
        dataroomUpload,
      });
    } catch (error) {
      return res.status(500).json((error as Error).message);
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
