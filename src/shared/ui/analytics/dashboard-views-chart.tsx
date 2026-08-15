import React from "react";
import { BarChart3, TrendingUp } from "lucide-react";

interface ViewPoint {
  date: string;
  views: number;
}

export interface DashboardViewsChartProps {
  timeRange: string;
  data?: ViewPoint[];
  startDate?: Date;
  endDate?: Date;
}

export function DashboardViewsChart({
  timeRange,
  data = [],
}: DashboardViewsChartProps) {
  const totalViews = data.reduce((acc, curr) => acc + (curr.views || 0), 0);
  const maxViews = Math.max(...data.map((d) => d.views || 0), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold">{totalViews.toLocaleString()}</span>
          <span className="ml-2 text-xs text-muted-foreground">total views ({timeRange})</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Live Metrics</span>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="flex h-48 items-end gap-2 pt-4">
          {data.map((point, index) => {
            const heightPercent = Math.max((point.views / maxViews) * 100, 8);
            return (
              <div key={index} className="flex flex-1 flex-col items-center gap-1 group">
                <div className="w-full flex-1 flex items-end">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full rounded-t bg-primary/80 group-hover:bg-primary transition-all duration-200"
                    title={`${point.date}: ${point.views} views`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                  {point.date ? point.date.slice(-5) : ""}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed text-center p-6">
          <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">No view data available</p>
          <p className="text-xs text-muted-foreground">Views on shared files and links will appear here</p>
        </div>
      )}
    </div>
  );
}

export default DashboardViewsChart;
