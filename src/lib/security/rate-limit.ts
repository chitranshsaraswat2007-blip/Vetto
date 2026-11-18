import "server-only";

import { headers } from "next/headers";

type RateLimitRule = {
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const MAX_BUCKETS = 10_000;

const globalForRateLimit = globalThis as unknown as {
  vettoRateLimits?: Map<string, RateLimitBucket>;
};

const buckets =
  globalForRateLimit.vettoRateLimits ?? new Map<string, RateLimitBucket>();

globalForRateLimit.vettoRateLimits = buckets;

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
): RateLimitResult {
  const now = Date.now();

  if (buckets.size >= MAX_BUCKETS) {
    pruneExpiredBuckets(now);

    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) {
        buckets.delete(oldestKey);
      }
    }
  }

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + rule.windowMs,
    });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > rule.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      ),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function getRequestAddress() {
  const requestHeaders = await headers();

  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    const firstAddress = forwardedFor.split(",")[0]?.trim();
    if (firstAddress) {
      return firstAddress;
    }
  }

  return requestHeaders.get("x-real-ip")?.trim() || "local";
}

export function rateLimitMessage(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
