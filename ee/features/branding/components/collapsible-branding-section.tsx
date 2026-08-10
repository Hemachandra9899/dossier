import { useState, ReactNode } from "react";

export function CollapsibleBrandingSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left font-semibold text-base flex justify-between items-center text-gray-900 dark:text-gray-100"
      >
        <span>{title}</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && children}
    </div>
  );
}
