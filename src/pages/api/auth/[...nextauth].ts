import { NextApiRequest, NextApiResponse } from "next";

import { checkRateLimit, rateLimiters } from "@/ee/features/security";
import NextAuth, { type NextAuthOptions } from "next-auth";

import { identifyUser, trackAnalytics } from "@/shared/utils/analytics";
import { authOptions } from "@/shared/utils/auth/auth-options";
import { dub } from "@/shared/utils/dub";
import { isBlacklistedEmail } from "@/shared/utils/edge-config/blacklist";
import { log } from "@/shared/utils/utils";
import { getIpAddress } from "@/shared/utils/utils/ip";

export { authOptions } from "@/shared/utils/auth/auth-options";

export const config = {
  maxDuration: 180,
};

const getAuthOptions = (req: NextApiRequest): NextAuthOptions => {
  return {
    ...authOptions,
    callbacks: {
      ...authOptions.callbacks,
      signIn: async ({ user, account, profile }) => {
        if (!user.email || (await isBlacklistedEmail(user.email))) {
          await identifyUser(user.email ?? user.id);
          await trackAnalytics({
            event: "User Sign In Attempted",
            email: user.email ?? undefined,
            userId: user.id,
          });
          return false;
        }

        // Apply rate limiting for signin attempts
        try {
          if (req) {
            const clientIP = getIpAddress(req.headers);
            const rateLimitResult = await checkRateLimit(
              rateLimiters.auth,
              clientIP,
            );

            if (!rateLimitResult.success) {
              log({
                message: `Rate limit exceeded for IP ${clientIP} during signin attempt`,
                type: "error",
              });
              return false;
            }
          }
        } catch (error) {}

        return true;
      },
    },
    events: {
      ...authOptions.events,
      signIn: async (message) => {
        await Promise.allSettled([
          identifyUser(message.user.email ?? message.user.id),
          trackAnalytics({
            event: "User Signed In",
            email: message.user.email,
          }),
        ]);

        if (message.isNewUser) {
          const { dub_id } = req.cookies;
          if (dub_id && process.env.DUB_API_KEY) {
            try {
              await dub.track.lead({
                clickId: dub_id,
                eventName: "Sign Up",
                customerExternalId: message.user.id,
                customerName: message.user.name,
                customerEmail: message.user.email,
                customerAvatar: message.user.image ?? undefined,
              });
            } catch (err) {
              console.error("dub.track.lead failed", err);
            }
          }
        }
      },
    },
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  return NextAuth(req, res, getAuthOptions(req));
}
