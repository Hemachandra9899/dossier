import { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "next-auth";

import { getFileForDocumentPage } from "@/shared/utils/documents/get-file-helper";
import { ratelimit } from "@/shared/utils/redis";
import { CustomUser } from "@/shared/utils/types";

import { authOptions } from "../auth/[...nextauth]";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).end("Unauthorized");
  }

  const userId = (session.user as CustomUser).id;
  const { success } = await ratelimit(150, "1 m").limit(
    `get-thumbnail:${userId}`,
  );
  if (!success) {
    return res.status(429).json({ message: "Too many requests" });
  }

  const { documentId, pageNumber, versionNumber } = req.query as {
    documentId: string;
    pageNumber: string;
    versionNumber: string;
  };

  try {
    const parsedVersionNumber =
      versionNumber && versionNumber !== "undefined"
        ? Number(versionNumber)
        : undefined;

    const imageUrl = await getFileForDocumentPage({
      pageNumber: Number(pageNumber),
      documentId,
      userId,
      versionNumber: parsedVersionNumber,
    });

    return res.status(200).json({ imageUrl });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    return;
  }
}
