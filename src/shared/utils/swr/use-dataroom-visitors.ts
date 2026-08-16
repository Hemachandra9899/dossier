import useSWR from "swr";

import {
  VisitorAccessSource,
  VisitorStatus,
} from "@/shared/ui/visitors/visitor-status-badge";

export interface DataroomVisitor {
  id: string | null;
  email?: string | null;
  viewerName?: string | null;
  verified?: boolean;
  internal?: boolean;
  isDomain?: boolean;
  downloads: number;
  totalVisits: number;
  documentViews: number;
  lastViewed?: string | null;
  status?: VisitorStatus;
  invitedAt?: Date | string | null;
  invitationStatus?: string | null;
  accessSources: VisitorAccessSource[];
  agreement?: { signed?: boolean; name?: string } | null;
  hasVisitedLinks?: boolean;
  linkNames?: string[];
}

export interface AnonymousVisitorStats {
  visits: number;
  lastViewed?: string | null;
}

export function useDataroomVisitors(..._args: any[]) {
  return {
    visitors: [],
    anonymous: [],
    pagination: {},
    sorting: {},
    isFiltered: false,
    data: { visitors: [], anonymous: [], pagination: {} },
  } as any;
}

export default useDataroomVisitors;
