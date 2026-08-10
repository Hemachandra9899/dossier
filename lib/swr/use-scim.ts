export default function useScim(opts?: any) {
  return {
    scimConfig: null,
    isLoading: false,
    error: null,
    mutate: () => Promise.resolve(),
    directories: [] as any[],
    configured: false,
    loading: false,
  };
}
