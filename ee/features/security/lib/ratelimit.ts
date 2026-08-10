import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis";

/**
 * Simple rate limiters for core endpoints
 */
export const rateLimiters = {
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "20 m"),
    prefix: "rl:auth",
    enableProtection: true,
    analytics: true,
  }),
  domainVerification: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "rl:domainVerification",
    analytics: true,
  }),
  bulkLinkImport: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "rl:bulkLinkImport",
    analytics: true,
  }),
};

/**
 * Apply rate limiting with error handling
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string,
): Promise<{ success: boolean; remaining?: number; error?: string }> {
  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
    };
  } catch (error) {
    console.error("Rate limiting error:", error);
    // Fail open - allow request if rate limiting fails
    return { success: true, error: "Rate limiting unavailable" };
  }
}
