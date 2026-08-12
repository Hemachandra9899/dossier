import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { identifyUser, trackAnalytics } from "@/lib/analytics";
import { qstash } from "@/lib/cron";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

const VERCEL_DEPLOYMENT = !!process.env.VERCEL_URL;

function getMainDomainUrl(): string {
  if (process.env.NODE_ENV === "development") {
    return process.env.NEXTAUTH_URL || "http://localhost:3000";
  }
  return process.env.NEXTAUTH_URL || "https://dossier.com";
}

export const authOptions: NextAuthOptions = {
  pages: {
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: `${VERCEL_DEPLOYMENT ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        domain: VERCEL_DEPLOYMENT ? undefined : undefined, // Handled automatically by Next.js or set explicitly per environment if needed
        secure: VERCEL_DEPLOYMENT,
      },
    },
  },
  callbacks: {
    jwt: async (params) => {
      const { token, user, trigger } = params;
      if (!token.email) {
        return {};
      }
      if (user) {
        token.user = user;
      }
      if (trigger === "update") {
        const currentUser = token?.user as CustomUser;
        const refreshedUser = await prisma.user.findUnique({
          where: { id: currentUser.id },
        });
        if (refreshedUser) {
          token.user = refreshedUser;
        } else {
          return {};
        }

        if (refreshedUser?.email !== currentUser.email) {
          if (currentUser.id && refreshedUser.email) {
            await prisma.account.deleteMany({
              where: { userId: currentUser.id },
            });
          }
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      (session.user as CustomUser) = {
        id: token.sub,
        // @ts-ignore
        ...(token || session).user,
      };
      return session;
    },
  },
  events: {
    async createUser(message) {
      await identifyUser(message.user.email ?? message.user.id);
      await trackAnalytics({
        event: "User Signed Up",
        email: message.user.email,
        userId: message.user.id,
      });

      await qstash.publishJSON({
        url: `${process.env.NEXT_PUBLIC_BASE_URL ?? getMainDomainUrl()}/api/cron/welcome-user`,
        body: {
          userId: message.user.id,
        },
        delay: 15 * 60,
      });
    },
  },
};
