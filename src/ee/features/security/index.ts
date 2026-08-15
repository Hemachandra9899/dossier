export function checkSecurity(_params: any) { return true; }
export const rateLimiters = {} as any;
export function checkRateLimit(..._args: any[]) {
  return { success: true, remaining: 100 } as any;
}
