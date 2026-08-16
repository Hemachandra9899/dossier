"use client";

import { useRouter } from "next/router";
import { useMemo } from "react";

import { Badge } from "@/shared/ui/badge";

const VALID_TABS = [
  "overview",
  "requirements",
  "documents",
  "signatures",
  "activity",
  "completion",
] as const;

type FileTab = (typeof VALID_TABS)[number];

function getFileTab(value: unknown): FileTab {
  return VALID_TABS.includes(value as FileTab)
    ? (value as FileTab)
    : "overview";
}

export function FileTabs({
  value,
  onChange,
}: {
  value: FileTab;
  onChange: (next: FileTab) => void;
}) {
  const router = useRouter();

  return (
    <div className="flex border-b gap-6 text-sm font-medium">
      {VALID_TABS.map((tab) => {
        const isActive = tab === value;
        const classes = [
          "pb-3",
          "capitalize",
          "transition-all",
          "border-b-2",
          "-mb-[2px]",
          isActive
            ? "border-neutral-800 text-neutral-800 dark:border-neutral-100 dark:text-neutral-100"
            : "border-transparent text-neutral-500 hover:text-neutral-800",
        ];

        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={classes.join(" ")}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}