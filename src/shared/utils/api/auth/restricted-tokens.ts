import { z } from "zod";
import prisma from "@/shared/utils/prisma";

export const RestrictedTokenSubjectTypeSchema = z.enum(["user", "machine"]);

export function parseRestrictedTokenSubjectType(v: any) {
  return RestrictedTokenSubjectTypeSchema.parse(v);
}

export async function revokeUserBoundTeamTokens(
  userId: string,
  teamId: string,
): Promise<void> {
  await prisma.restrictedToken.deleteMany({
    where: {
      userId,
      teamId,
      subjectType: "user",
    },
  });
}
