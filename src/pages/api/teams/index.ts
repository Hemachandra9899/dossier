import { NextApiRequest, NextApiResponse } from "next";

import {
  PREMIUM_TEAM_LIMIT,
  getPremiumTeamEligibility,
} from "@/ee/limits/can-create-premium-team";
import { canCreateUnlimitedTeam } from "@/ee/limits/can-create-unlimited-team";
import {
  DATAROOMS_PREMIUM_PLAN_LIMITS,
  DATAROOMS_UNLIMITED_PLAN_LIMITS,
} from "@/ee/limits/constants";
import { getServerSession } from "next-auth";

import { errorhandler } from "@/shared/utils/errorHandler";
import prisma from "@/platform/db";
import { CustomUser } from "@/shared/utils/types";
import { log } from "@/shared/utils/utils";

import { authOptions } from "../auth/[...nextauth]";

async function resolveDbUserId(user: CustomUser): Promise<string> {
  if (!user) return "";

  if (user.id) {
    const existingById = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (existingById) {
      return existingById.id;
    }
  }

  if (user.email) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    if (existingByEmail) {
      return existingByEmail.id;
    }

    const createdUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...(user.id ? { id: user.id } : {}),
        email: user.email,
        name: user.name || user.email.split("@")[0],
        image: user.image,
      },
      select: { id: true },
    });
    return createdUser.id;
  }

  if (user.id) {
    const createdUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        name: user.name || "User",
      },
      select: { id: true },
    });
    return createdUser.id;
  }

  return "";
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    // GET /api/teams
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).end("Unauthorized");
    }

    const user = session.user as CustomUser;

    try {
      const dbUserId = await resolveDbUserId(user);
      if (!dbUserId) {
        return res.status(200).json([]);
      }

      const userTeams = await prisma.userTeam.findMany({
        where: {
          userId: dbUserId,
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              plan: true,
              createdAt: true,
              enableExcelAdvancedMode: true,
              replicateDataroomFolders: true,
            },
          },
        },
        orderBy: {
          team: {
            createdAt: "asc",
          },
        },
      });

      const teams = userTeams.map((userTeam) => userTeam.team);

      // if no teams then create a default one
      if (teams.length === 0) {
        const defaultTeamName = user.name
          ? `${user.name}'s Team`
          : "Personal Team";
        const defaultTeam = await prisma.team.create({
          data: {
            name: defaultTeamName,
            users: {
              create: {
                userId: dbUserId,
                role: "ADMIN",
              },
            },
          },
          select: {
            id: true,
            name: true,
            plan: true,
            createdAt: true,
            enableExcelAdvancedMode: true,
            replicateDataroomFolders: true,
          },
        });
        teams.push(defaultTeam);
      }

      return res.status(200).json(teams);
    } catch (error) {
      log({
        message: `Failed to find team for user: _${user?.id}_ \n\n ${error}`,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else if (req.method === "POST") {
    // POST /api/teams
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).end("Unauthorized");
    }

    const { team } = req.body;

    const user = session.user as CustomUser;

    try {
      const dbUserId = await resolveDbUserId(user);
      if (!dbUserId) {
        return res.status(400).json({ message: "Invalid user" });
      }

      const grantUnlimited = await canCreateUnlimitedTeam(dbUserId);

      // Datarooms-premium admins can provision their own teams (same
      // principle as datarooms-unlimited), but are capped at
      // PREMIUM_TEAM_LIMIT teams. Unlimited takes precedence.
      const premiumEligibility = grantUnlimited
        ? null
        : await getPremiumTeamEligibility(dbUserId);

      if (
        premiumEligibility?.isPremiumAdmin &&
        !premiumEligibility.canCreate
      ) {
        return res
          .status(403)
          .json(
            `You have reached the limit of ${PREMIUM_TEAM_LIMIT} teams for your plan.`,
          );
      }

      const grantPremium = premiumEligibility?.canCreate ?? false;

      const newTeam = await prisma.team.create({
        data: {
          name: team,
          ...(grantUnlimited
            ? {
                plan: "datarooms-unlimited",
                limits: structuredClone(DATAROOMS_UNLIMITED_PLAN_LIMITS),
              }
            : grantPremium
              ? {
                  plan: "datarooms-premium",
                  limits: structuredClone(DATAROOMS_PREMIUM_PLAN_LIMITS),
                }
              : {}),
          users: {
            create: {
              userId: dbUserId,
              role: "ADMIN",
            },
          },
        },
        include: {
          users: true,
        },
      });

      return res.status(201).json(newTeam);
    } catch (error) {
      log({
        message: `Failed to create team "${team}" for user: _${user.id}_. \n\n*Error*: \n\n ${error}`,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
