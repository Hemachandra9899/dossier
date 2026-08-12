import prisma from "@/lib/prisma";

export async function getFileTimeline(fileId: string) {
  const file = await prisma.dossierFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      requirementsTaskListId: true,
      signatureRequests: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!file) return [];

  const [fileActivities, taskActivities, signatureActivities] =
    await Promise.all([
      prisma.dossierFileActivity.findMany({
        where: { fileId },
        orderBy: { occurredAt: "desc" },
      }),

      file.requirementsTaskListId
        ? prisma.taskActivity.findMany({
            where: {
              task: {
                taskListId: file.requirementsTaskListId,
              },
            },
            include: {
              task: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          })
        : Promise.resolve([]),

      prisma.signatureActivity.findMany({
        where: {
          signatureRequest: {
            dossierFileId: fileId,
          },
        },
        include: {
          recipient: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      }),
    ]);

  const merged = [
    ...fileActivities.map((event) => ({
      source: "FILE" as const,
      type: event.type,
      at: event.occurredAt,
      metadata: event.metadata,
    })),

    ...taskActivities.map((event) => ({
      source: "REQUIREMENT" as const,
      type: event.type,
      at: event.createdAt,
      metadata: {
        taskId: event.task.id,
        taskTitle: event.task.title,
        comment: event.comment,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
      },
    })),

    ...signatureActivities.map((event) => ({
      source: "SIGNATURE" as const,
      type: event.type,
      at: event.timestamp,
      metadata: {
        recipient: event.recipient,
        providerMetadata: event.metadata,
      },
    })),
  ];

  return merged.sort(
    (a, b) => b.at.getTime() - a.at.getTime(),
  );
}
