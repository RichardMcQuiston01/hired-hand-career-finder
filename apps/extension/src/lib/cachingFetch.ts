/**
 * Wraps `fetch` with a `localStorage`-backed response cache and a
 * self-imposed call-rate cap, both scoped to this one browser profile.
 *
 * There is no backend in this architecture (see
 * docs/DEVELOPMENT_PLAN.md's "Key decisions" section) to coordinate
 * requests across every install of the extension, so this can only ever
 * protect against *this* installation running away with itself — a bug, an
 * accidental refresh loop, unusually heavy use in one session — not the
 * aggregate load every user's install together puts on the one shared
 * O*NET API key. That tradeoff is deliberate: the O*NET key isn't treated
 * as a secret, and the only real risk is exceeding O*NET's own ("best
 * effort", not precisely published) rate limits, which O*NET's own docs
 * recommend addressing by caching repeat requests — most of what this
 * client asks for (career search terms, browsed occupations, the Interest
 * Profiler's fixed question sets) repeats heavily and barely changes, so a
 * cache does most of the real work here.
 */

const CACHE_PREFIX = 'onet-cache:v1:';
const RATE_LIMIT_KEY = 'onet-rate:v1';

/** Interest Profiler question sets are static reference data — cache them far longer than everything else. */
const LONG_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_CALLS = 20; // generous for normal human-driven use, still a real ceiling

interface CacheEntry {
  status: number;
  contentType: string;
  body: string;
  cachedAt: number;
}

interface RateLimitState {
  windowStart: number;
  count: number;
}

function readJson<T>(storage: Storage, key: string): T | undefined {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined; // Corrupt entry, quota/privacy-mode weirdness — treat as absent.
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded, private browsing, etc. — caching/throttling is best-effort, never fatal.
  }
}

function cacheTtlFor(url: string): number {
  return url.includes('/interestprofiler/questions') ? LONG_CACHE_TTL_MS : DEFAULT_CACHE_TTL_MS;
}

function readCache(storage: Storage, url: string): Response | undefined {
  const entry = readJson<CacheEntry>(storage, CACHE_PREFIX + url);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > cacheTtlFor(url)) return undefined;
  return new Response(entry.body, {
    status: entry.status,
    headers: { 'Content-Type': entry.contentType },
  });
}

async function writeCache(storage: Storage, url: string, response: Response): Promise<void> {
  const body = await response.text();
  const entry: CacheEntry = {
    status: response.status,
    contentType: response.headers.get('Content-Type') ?? 'application/json',
    body,
    cachedAt: Date.now(),
  };
  writeJson(storage, CACHE_PREFIX + url, entry);
}

/** Returns `true` and records the call if under budget; `false` if the caller should be refused. */
function tryConsumeRateLimitBudget(storage: Storage): boolean {
  const now = Date.now();
  const state = readJson<RateLimitState>(storage, RATE_LIMIT_KEY);
  const fresh = !state || now - state.windowStart > RATE_LIMIT_WINDOW_MS;
  const current: RateLimitState = fresh
    ? { windowStart: now, count: 0 }
    : { windowStart: state.windowStart, count: state.count };

  if (current.count >= RATE_LIMIT_MAX_CALLS) {
    return false;
  }

  current.count += 1;
  writeJson(storage, RATE_LIMIT_KEY, current);
  return true;
}

function rateLimitedResponse(): Response {
  return new Response(
    JSON.stringify({
      error:
        "You've made a lot of requests in the last minute. Please wait a moment and try again.",
    }),
    { status: 429, headers: { 'Content-Type': 'application/json' } },
  );
}

/**
 * Creates a `fetch`-compatible function for `createOnetMnmClient`'s
 * `fetchImpl` option. Every request this client package makes is a GET, so
 * caching by exact URL (path + query string) is safe and sufficient — no
 * method/body to consider.
 */
export function createCachingFetch(
  storage: Storage = globalThis.localStorage,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    const cached = readCache(storage, url);
    if (cached) return cached;

    if (!tryConsumeRateLimitBudget(storage)) {
      return rateLimitedResponse();
    }

    const response = await fetchImpl(input, init);
    if (response.ok) {
      await writeCache(storage, url, response.clone());
    }
    return response;
  };
}
