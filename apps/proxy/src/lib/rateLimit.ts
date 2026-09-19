/**
 * Best-effort rate limiting for the O*NET proxy route.
 *
 * KNOWN v1 LIMITATION: this is an in-memory, per-process fixed-window
 * counter. On Vercel (and most serverless platforms) each region/instance
 * runs its own process, so a client's requests can land on different
 * instances and this limiter will NOT see a globally consistent count — a
 * client could exceed the intended limit by a multiple of the instance
 * count. This is a known, accepted v1 limitation (there are no KV/Redis
 * credentials available to this project yet), not a bug to chase down.
 *
 * The `RateLimiter` interface below is the seam for swapping this out for a
 * durable, shared store (e.g. Upstash Redis) later without touching call
 * sites — only the implementation passed to `checkRateLimit` needs to
 * change.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Present only when `allowed` is false. */
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

interface Bucket {
  count: number;
  windowStart: number;
}

/** A simple fixed-window counter keyed by an arbitrary string (e.g. client IP). */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }

    if (bucket.count < this.limit) {
      bucket.count += 1;
      return { allowed: true };
    }

    const retryAfterMs = this.windowMs - (now - bucket.windowStart);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  /** Test-only escape hatch to drop all tracked state. */
  reset(): void {
    this.buckets.clear();
  }
}

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Shared limiter instance used by the route handler in production. Limits
 * are configurable via env vars so they can be tuned per-deployment without
 * a code change.
 */
export const defaultRateLimiter = new InMemoryRateLimiter(
  readIntEnv('RATE_LIMIT_MAX_REQUESTS', DEFAULT_LIMIT),
  readIntEnv('RATE_LIMIT_WINDOW_MS', DEFAULT_WINDOW_MS),
);

export function checkRateLimit(key: string): RateLimitResult {
  return defaultRateLimiter.check(key);
}
