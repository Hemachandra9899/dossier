import useSWR from "swr";

export function useViewers(..._args: any[]) {
  return { data: { viewers: [], anonymous: [], pagination: {} } } as any;
}

export default useViewers;
