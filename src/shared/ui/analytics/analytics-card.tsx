import React from "react";

export interface AnalyticsCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  contentClassName?: string;
  children?: React.ReactNode;
}

export function AnalyticsCard({
  title,
  description,
  icon,
  contentClassName = "",
  children,
}: AnalyticsCardProps) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm transition-all">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-primary">{icon}</span>}
          <div>
            <h3 className="text-base font-semibold leading-none tracking-tight">{title}</h3>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
        </div>
      </div>
      <div className={`p-6 ${contentClassName}`}>{children}</div>
    </div>
  );
}

export default AnalyticsCard;
