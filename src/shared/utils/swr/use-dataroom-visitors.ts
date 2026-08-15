import useSWR from "swr";

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
