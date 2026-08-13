import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";

export class FileAuthorizationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireTeamMembership(
  req: NextApiRequest,
  res: NextApiResponse,
  teamId: string,
) {
  const session = await getServerSession(req, res, authOptions);

  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    throw new FileAuthorizationError(401, "Unauthorized");
  }

  const membership = await prisma.userTeam.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new FileAuthorizationError(403, "Forbidden");
  }

  return {
    userId,
    membership,
  };
}

export async function requireFileAccess(
  req: NextApiRequest,
  res: NextApiResponse,
  fileId: string,
) {
  const file = await prisma.dossierFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      teamId: true,
      dataroomId: true,
      requirementsTaskListId: true,
    },
  });

  if (!file) {
    throw new FileAuthorizationError(404, "File not found");
  }

  const { userId, membership } = await requireTeamMembership(
    req,
    res,
    file.teamId,
  );

  if (membership.role === "DATAROOM_MEMBER") {
    const scope = await prisma.userDataroom.findUnique({
      where: {
        userId_dataroomId: {
          userId,
          dataroomId: file.dataroomId,
        },
      },
    });

    if (!scope) {
      throw new FileAuthorizationError(404, "File not found");
    }
  }

  return {
    file,
    userId,
    membership,
  };
}

/**
 * Like requireFileAccess but additionally gates on manage-level roles.
 * Only ADMIN, MANAGER, and MEMBER may dismiss issues or close files.
 * DATAROOM_MEMBER and VIEWER are rejected with 403.
 */
export async function requireFileManageAccess(
  req: NextApiRequest,
  res: NextApiResponse,
  fileId: string,
) {
  const result = await requireFileAccess(req, res, fileId);

  const manageRoles = ["ADMIN", "MANAGER", "MEMBER"] as const;
  if (!manageRoles.includes(result.membership.role as (typeof manageRoles)[number])) {
    throw new FileAuthorizationError(403, "Insufficient permissions");
  }

  return result;
}

export function sendAuthorizationError(
  res: NextApiResponse,
  error: unknown,
) {
  if (error instanceof FileAuthorizationError) {
    res.status(error.statusCode).json({ error: error.message });
    return true;
  }

  return false;
}
