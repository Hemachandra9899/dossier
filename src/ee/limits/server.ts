export function checkLimits(_params: any) { return true; }
export function getLimits(_params: any) {
  return {
    datarooms: { count: 0, limit: 100 },
    links: { count: 0, limit: 100 },
    documents: { count: 0, limit: 100 },
    users: { count: 0, limit: 100 },
    usage: { count: 0, limit: 100 },
  } as any;
}
