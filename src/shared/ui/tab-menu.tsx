import React from "react";
import Link from "next/link";

export interface TabItem {
  label: string;
  href: string;
  value: string;
  currentValue?: string;
  count?: number;
}

export function TabMenu({
  navigation,
  className = "",
}: {
  navigation: TabItem[];
  className?: string;
}) {
  return (
    <div className={`flex border-b border-border/80 ${className}`}>
      <div className="flex space-x-2">
        {navigation.map((tab) => {
          const isActive = tab.currentValue === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.href}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default TabMenu;
