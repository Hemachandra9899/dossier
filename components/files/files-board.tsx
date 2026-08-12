import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo } from "react";

import type { FileBoardCard } from "@/modules/files/ui/files-api";
import { filesApi } from "@/modules/files/ui/files-api";
import { FileColumn } from "./file-column";

export const FILE_COLUMNS = [
  { id: "NEW", label: "New" },
  { id: "COLLECTING", label: "Collecting" },
  { id: "WAITING_ON_CLIENT", label: "Waiting on client" },
  { id: "REVIEWING", label: "Review" },
  { id: "NEEDS_CORRECTION", label: "Needs correction" },
  { id: "READY_TO_SIGN", label: "Ready to sign" },
  { id: "SIGNING", label: "Signing" },
  { id: "COMPLETE", label: "Complete" },
] as const;

type Props = {
  files: FileBoardCard[];
  onMutate: () => Promise<unknown> | unknown;
};

export function FilesBoard({ files, onMutate }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const filesByStatus = useMemo(() => {
    return Object.fromEntries(
      FILE_COLUMNS.map((column) => [
        column.id,
        files
          .filter((file) => file.status === column.id)
          .sort((a, b) => a.position - b.position),
      ]),
    ) as Record<string, FileBoardCard[]>;
  }, [files]);

  async function handleDragEnd(event: DragEndEvent) {
    const fileId = String(event.active.id);
    const targetStatus = event.over?.data.current?.status as
      | string
      | undefined;

    if (!targetStatus) return;

    const source = files.find((file) => file.id === fileId);
    if (!source) return;

    // COMPLETE should be reached through workflow completion,
    // not arbitrary dragging.
    if (targetStatus === "COMPLETE") return;

    const targetFiles = filesByStatus[targetStatus] ?? [];
    const last = targetFiles[targetFiles.length - 1];

    const position = (last?.position ?? 0) + 1000;

    await filesApi.move({
      fileId,
      status: targetStatus,
      position,
    });

    await onMutate();
  }

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-[calc(100vh-12rem)] gap-4 overflow-x-auto pb-4">
        {FILE_COLUMNS.map((column) => (
          <FileColumn
            key={column.id}
            id={column.id}
            label={column.label}
            files={filesByStatus[column.id] ?? []}
          />
        ))}
      </div>
    </DndContext>
  );
}
