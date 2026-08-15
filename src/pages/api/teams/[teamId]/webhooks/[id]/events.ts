import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

import prisma from "@/platform/db";
import { getWebhookEvents } from "@/shared/utils/tinybird/pipes";
import { CustomUser } from "@/shared/utils/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { teamId, id: webhookId } = req.query as { teamId: string; id: string };
  const userId = (session.user as CustomUser).id;

  const userTeam = await prisma.userTeam.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });

  if (!userTeam) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    try {
      const { pId } = await prisma.webhook.findUniqueOrThrow({
        where: {
          id: webhookId,
          teamId,
        },
        select: {
          pId: true,
        },
      });

      const events = await getWebhookEvents({
        webhookId: pId,
      });

      const parsedEvents = events.data.map((event) => ({
        ...event,
        request_body: JSON.parse(event.request_body as string),
      }));

      return res.status(200).json(parsedEvents);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
