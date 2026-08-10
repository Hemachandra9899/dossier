export default function useSaml(opts?: any) {
  return {
    samlConfig: null,
    isLoading: false,
    error: null,
    mutate: () => Promise.resolve(),
    connections: [],
    issuer: "",
    acs: "",
    loading: false,
    configured: false,
    ssoEmailDomain: null,
    ssoEnforcedAt: null,
    slug: null,
  };
}
