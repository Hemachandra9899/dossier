import { useDroppable } from "@dnd-kit/core";

import type { FileBoardCard } from "@/modules/files/ui/files-api";
import { FileCard } from "./file-card";

type Props = {
  id: string;
  label: string;
  files: FileBoardCard[];
};

export function FileColumn({ id, label, files }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${id}`,
    data: {
      status: id,
    },
  });

  return (
    <section
      ref={setNodeRef}
      className={[
        "w-[310px] shrink-0 rounded-xl border bg-muted/30 p-3",
        isOver ? "ring-2 ring-primary/30" : "",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {files.length}
        </span>
      </div>

      <div className="space-y-3">
        {files.map((file) => (
          <FileCard key={file.id} file={file} />
        ))}

        {files.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Drop files here
          </div>
        ) : null}
      </div>
    </section>
  );
}
