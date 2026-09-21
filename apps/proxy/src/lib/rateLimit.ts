/**
 * Rate limiting for the O*NET proxy route: one limiter keyed per client IP
 * (`checkRateLimit`, stops a single abusive client), and one limiter with a
 * single fixed key covering every request regardless of client
 * (`checkGlobalRateLimit`) — this is what actually protects the one shared
 * O*NET API key's aggregate usage across every user of the extension, which
 * a per-client limiter alone cannot do (many distinct, well-behaved clients
 * can still collectively exceed what the key is allowed).
 *
 * Both are in-memory, per-process fixed-window counters. This is only
 * globally accurate as long as this proxy runs as a single process — this
 * project's deployment target is one Docker container on one VPS, not
 * multi-instance serverless, so that holds. If this is ever scaled to
 * multiple replicas, both limiters would need a shared store (e.g. Redis)
 * to stay accurate — the `RateLimiter` interface below is the seam for that
 * later, without touching call sites.
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

/**
 * A starting guess, not a number O*NET publishes — their docs describe
 * "best effort" service with unspecified throttling rather than a precise
 * limit. Tune `GLOBAL_RATE_LIMIT_MAX_REQUESTS` based on observed usage or
 * O*NET's own feedback once this is actually deployed.
 */
const DEFAULT_GLOBAL_LIMIT = 300;
const DEFAULT_GLOBAL_WINDOW_MS = 60_000;

const GLOBAL_KEY = '__global__';

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Shared limiter instances used by the route handler in production. Limits
 * are configurable via env vars so they can be tuned per-deployment without
 * a code change.
 */
export const defaultRateLimiter = new InMemoryRateLimiter(
  readIntEnv('RATE_LIMIT_MAX_REQUESTS', DEFAULT_LIMIT),
  readIntEnv('RATE_LIMIT_WINDOW_MS', DEFAULT_WINDOW_MS),
);

export const defaultGlobalRateLimiter = new InMemoryRateLimiter(
  readIntEnv('GLOBAL_RATE_LIMIT_MAX_REQUESTS', DEFAULT_GLOBAL_LIMIT),
  readIntEnv('GLOBAL_RATE_LIMIT_WINDOW_MS', DEFAULT_GLOBAL_WINDOW_MS),
);

export function checkRateLimit(key: string): RateLimitResult {
  return defaultRateLimiter.check(key);
}

export function checkGlobalRateLimit(): RateLimitResult {
  return defaultGlobalRateLimiter.check(GLOBAL_KEY);
}
