import React from "react";

export type DashboardTimeRange = "24h" | "7d" | "30d" | "custom";

export const DASHBOARD_TIME_RANGES: { label: string; value: DashboardTimeRange }[] = [
  { label: "Last 24 Hours", value: "24h" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Custom Range", value: "custom" },
];

export function isDashboardTimeRange(value: any): value is DashboardTimeRange {
  return ["24h", "7d", "30d", "custom"].includes(value);
}

export interface TimeRangeSelectProps {
  value: DashboardTimeRange;
  onChange: (val: DashboardTimeRange) => void;
  ranges?: { label: string; value: DashboardTimeRange }[];
  customRange?: { start: Date; end: Date };
  setCustomRange?: React.Dispatch<React.SetStateAction<{ start: Date; end: Date }>>;
  onCustomRangeComplete?: (range: { start: Date; end: Date }) => void;
  slug?: React.MutableRefObject<boolean>;
  isPremium?: boolean;
}

export function TimeRangeSelect({
  value,
  onChange,
  ranges = DASHBOARD_TIME_RANGES,
}: TimeRangeSelectProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm">
      {ranges.map((range) => {
        const isActive = value === range.value;
        return (
          <button
            key={range.value}
            onClick={() => onChange(range.value)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}

export default TimeRangeSelect;
