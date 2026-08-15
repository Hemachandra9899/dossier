import { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "next-auth/next";

import {
  finishServerPasskeyRegistration,
  startServerPasskeyRegistration,
} from "@/shared/utils/api/auth/passkey";
import { errorhandler } from "@/shared/utils/errorHandler";

import { authOptions } from "../auth/[...nextauth]";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).end("Unauthorized");
    }

    const { start, finish, credential } = req.body as {
      start: boolean;
      finish: boolean;
      credential: any;
    };

    try {
      if (start) {
        const createOptions = await startServerPasskeyRegistration({ session });
        res.status(200).json({ createOptions });
        return;
      }
      if (finish) {
        await finishServerPasskeyRegistration({ credential, session });
        res.status(200).json({ message: "Registered Passkey" });
        return;
      }
    } catch (error) {
      errorhandler(error, res);
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
