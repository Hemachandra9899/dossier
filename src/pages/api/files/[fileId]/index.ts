import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@/lib/prisma";
import {
  requireFileAccess,
  sendAuthorizationError,
} from "@/modules/files/server/authorization";
import { getFileTimeline } from "@/modules/files/application/get-file-timeline";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const fileId = String(req.query.fileId || "");

  try {
    const { userId } = await requireFileAccess(req, res, fileId);

    const file = await prisma.dossierFile.findUnique({
      where: { id: fileId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        requirementsTaskList: {
          include: {
            tasks: {
              orderBy: { orderIndex: "asc" },
              include: {
                assignments: true,
                policy: true,
                analyses: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  include: {
                    issues: {
                      orderBy: { createdAt: "asc" },
                    },
                  },
                },
              },
            },
          },
        },
        signatureRequests: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            recipients: true,
          },
        },
        dataroom: {
          select: {
            id: true,
            pId: true,
            name: true,
            links: {
              where: {
                isArchived: false,
                deletedAt: null,
              },
              select: {
                id: true,
                url: true,
                name: true,
                enableUpload: true,
                expiresAt: true,
              },
            },
            documents: {
              include: {
                document: {
                  include: {
                    versions: {
                      orderBy: {
                        versionNumber: "desc",
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const [notes, timeline] = await Promise.all([
      prisma.dossierFileNote.findMany({
        where: { fileId },
        orderBy: { createdAt: "desc" },
      }),
      getFileTimeline(fileId),
    ]);

    return res.status(200).json({ file, notes, timeline });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
