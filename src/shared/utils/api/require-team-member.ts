// Route-layer auth helper for the Dossier signing API. Runs the NextAuth
// session check plus a team-membership query, then returns the authenticated
// user (or null after writing a 401). Keeps individual route handlers thin and
// consistent; business queries stay in repositories/application services.

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import prisma from "@/shared/utils/prisma";
import { authOptions } from "@/shared/utils/auth/auth-options";
import type { CustomUser } from "@/shared/utils/types";

export async function requireTeamMember(
  req: NextApiRequest,
  res: NextApiResponse,
  teamId: string,
): Promise<CustomUser | null> {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).end("Unauthorized");
    return null;
  }

  const user = session.user as CustomUser;

  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
      users: { some: { userId: user.id } },
    },
    select: { id: true },
  });

  if (!team) {
    res.status(401).end("Unauthorized");
    return null;
  }

  return user;
}
