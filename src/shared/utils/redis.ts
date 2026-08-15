import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasRedis = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL as string,
      token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    })
  : ({
      get: async () => null,
      set: async () => "OK",
      del: async () => 1,
      incr: async () => 1,
      expire: async () => 1,
      eval: async () => null,
    } as unknown as Redis);

export const lockerRedisClient =
  process.env.UPSTASH_REDIS_REST_LOCKER_URL && process.env.UPSTASH_REDIS_REST_LOCKER_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_LOCKER_URL as string,
        token: process.env.UPSTASH_REDIS_REST_LOCKER_TOKEN as string,
      })
    : redis;

// Create a new ratelimiter, that allows 10 requests per 10 seconds by default
export const ratelimit = (
  requests: number = 10,
  seconds:
    | `${number} ms`
    | `${number} s`
    | `${number} m`
    | `${number} h`
    | `${number} d` = "10 s",
) => {
  if (!hasRedis) {
    return {
      limit: async (_id: string) => ({
        success: true,
        limit: requests,
        remaining: requests - 1,
        reset: Date.now() + 10000,
      }),
    } as unknown as Ratelimit;
  }

  return new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(requests, seconds),
    analytics: true,
    prefix: "dossier",
  });
};
