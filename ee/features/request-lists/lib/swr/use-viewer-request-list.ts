export function useViewerRequestList(opts?: any) {
  return {
    enabled: false,
    data: null,
    error: null,
    isLoading: false,
    mutate: () => Promise.resolve(),
  };
}
