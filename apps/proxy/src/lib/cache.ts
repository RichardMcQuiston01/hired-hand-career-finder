/**
 * In-process response cache for successful upstream O*NET responses, keyed
 * by the exact upstream path + query string. O*NET's own docs recommend
 * caching repeat requests rather than relying on a precise published rate
 * limit (there isn't one) — and since this proxy runs as a single
 * long-lived Docker container (not ephemeral serverless), an in-memory
 * cache here is shared across every request from every client, unlike the
 * per-instance limitation `rateLimit.ts` documents for a multi-instance
 * deployment.
 */

interface CacheEntry {
  status: number;
  body: string;
  cachedAt: number;
}

/** Interest Profiler question sets are static reference data — cache far longer than everything else. */
const LONG_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const store = new Map<string, CacheEntry>();

function ttlFor(cacheKey: string): number {
  return cacheKey.includes('/interestprofiler/questions') ? LONG_TTL_MS : DEFAULT_TTL_MS;
}

export function readCache(cacheKey: string): CacheEntry | undefined {
  const entry = store.get(cacheKey);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > ttlFor(cacheKey)) {
    store.delete(cacheKey);
    return undefined;
  }
  return entry;
}

export function writeCache(cacheKey: string, status: number, body: string): void {
  store.set(cacheKey, { status, body, cachedAt: Date.now() });
}

/** Test-only escape hatch to drop all cached state. */
export function clearCache(): void {
  store.clear();
}
