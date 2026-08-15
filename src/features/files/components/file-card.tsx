import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import {
  CalendarDays,
  FileCheck2,
  PenLine,
  UserRound,
} from "lucide-react";

import type { FileBoardCard } from "@/features/files/ui/files-api";

export function FileCard({ file }: { file: FileBoardCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: file.id,
      data: {
        status: file.status,
      },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={[
        "rounded-xl border bg-background p-3 shadow-sm transition",
        isDragging ? "opacity-60 shadow-lg" : "hover:shadow-md cursor-grab active:cursor-grabbing",
      ].join(" ")}
    >
      <Link
        href={`/files/${file.id}`}
        onClick={(event) => event.stopPropagation()}
        className="block"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              {file.clientName || file.title}
            </h3>
            {file.clientName ? (
              <p className="truncate text-xs text-muted-foreground">
                {file.title}
              </p>
            ) : null}
          </div>

          <span className="rounded-md border bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
            {file.priority}
          </span>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {file.progress.completed}/{file.progress.total} complete
            </span>
            <span>{file.progress.percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-neutral-800 dark:bg-neutral-200 transition-all"
              style={{
                width: `${file.progress.percent}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          {file.owner ? (
            <div className="flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5" />
              <span className="truncate">
                {file.owner.name || file.owner.email}
              </span>
            </div>
          ) : null}

          {file.dueAt ? (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>
                {new Date(file.dueAt).toLocaleDateString()}
              </span>
            </div>
          ) : null}

          {file.activeSignature ? (
            <div className="flex items-center gap-1.5 text-orange-600 font-medium">
              <PenLine className="h-3.5 w-3.5" />
              <span>
                Signature: {file.activeSignature.status}
              </span>
            </div>
          ) : file.status === "COMPLETE" ? (
            <div className="flex items-center gap-1.5 text-green-600 font-medium">
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>Complete</span>
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
