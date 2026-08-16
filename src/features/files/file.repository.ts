// Repository layer for Files board data.

import { prisma } from "@/platform/db";

import type { FileBoardItem } from "./file.types";
import type { FileStatus } from "./file-status";

export async function getFilesForBoard(
  teamId: string,
): Promise<FileBoardItem[]> {
  const rows = await prisma.dossierFile.findMany({
    where: {
      teamId,
      archivedAt: null,
    },

    orderBy: [
      { status: "asc" },
      { position: "asc" },
      { createdAt: "desc" },
    ],

    select: {
      id: true,
      title: true,
      clientName: true,
      caseType: true,
      status: true,
      priority: true,
      dueAt: true,
      position: true,
      requiresSignature: true,

      owner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },

      requirementsTaskList: {
        select: {
          tasks: {
            select: {
              status: true,
            },
          },
        },
      },

      signatureRequests: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,

        select: {
          status: true,

          recipients: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

  return rows.map(toFileBoardItem);
}

function toFileBoardItem(
  row: any,
): FileBoardItem {
  const signing =
    row.signatureRequests?.[0] ?? {};

  return {
    id: row.id,
    title: row.title,
    clientName: row.clientName,
    caseType: row.caseType,

    status: row.status as FileStatus,
    priority: row.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT",

    owner: row.owner ?? null,

    dueAt: row.dueAt,

    requirements: {
      total: row.requirementsTaskList?.tasks?.length ?? 0,
      completed: row.requirementsTaskList?.tasks?.filter(
        (t: any) => t.status === "COMPLETED",
      ).length ?? 0,
      submitted: 0,
      corrections: 0,
    },

    signing: {
      required: row.requiresSignature ?? false,
      status: signing.status ?? null,
      signed: signing.recipients
        ? signing.recipients.filter(
            (r: any) => r.status === "SIGNED",
          ).length ?? 0
        : 0,
      total: signing.recipients?.length ?? 0,
    },

    position: row.position ?? 0,
  };
}