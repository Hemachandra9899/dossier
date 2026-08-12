import type { Role } from "@prisma/client";

import prisma from "@/lib/prisma";

export async function getFilesBoard(input: {
  teamId: string;
  userId: string;
  role: Role;
}) {
  const allowedDataroomIds =
    input.role === "DATAROOM_MEMBER"
      ? (
          await prisma.userDataroom.findMany({
            where: {
              teamId: input.teamId,
              userId: input.userId,
            },
            select: {
              dataroomId: true,
            },
          })
        ).map((row) => row.dataroomId)
      : null;

  const files = await prisma.dossierFile.findMany({
    where: {
      teamId: input.teamId,
      archivedAt: null,
      ...(allowedDataroomIds
        ? {
            dataroomId: {
              in: allowedDataroomIds,
            },
          }
        : {}),
    },
    orderBy: [
      { status: "asc" },
      { position: "asc" },
      { updatedAt: "desc" },
    ],
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
            select: {
              id: true,
              status: true,
              type: true,
              dueDate: true,
            },
          },
        },
      },
      signatureRequests: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          status: true,
          completedAt: true,
          recipients: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
        },
      },
      dataroom: {
        select: {
          id: true,
          pId: true,
          name: true,
          updatedAt: true,
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
        },
      },
    },
  });

  return files.map((file) => {
    const tasks = file.requirementsTaskList?.tasks ?? [];
    const completed = tasks.filter(
      (task) => task.status === "COMPLETED",
    ).length;
    const submitted = tasks.filter(
      (task) => task.status === "SUBMITTED",
    ).length;

    return {
      id: file.id,
      teamId: file.teamId,
      dataroomId: file.dataroomId,
      title: file.title,
      clientName: file.clientName,
      clientEmail: file.clientEmail,
      reference: file.reference,
      caseType: file.caseType,
      status: file.status,
      priority: file.priority,
      dueAt: file.dueAt,
      position: file.position,
      requiresSignature: file.requiresSignature,
      updatedAt: file.updatedAt,
      owner: file.owner,

      progress: {
        completed,
        submitted,
        total: tasks.length,
        percent:
          tasks.length === 0
            ? 0
            : Math.round((completed / tasks.length) * 100),
      },

      activeSignature:
        file.signatureRequests.find(
          (r) =>
            !["COMPLETED", "CANCELLED", "FAILED", "EXPIRED"].includes(
              r.status,
            ),
        ) ?? null,

      clientLink: file.dataroom.links[0] ?? null,
    };
  });
}
