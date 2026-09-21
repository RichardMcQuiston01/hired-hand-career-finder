import { createOnetMnmClient } from '@hired-hand/onet-mnm-client';
import { createCachingFetch } from './cachingFetch';

/**
 * Base URL of this project's O*NET API proxy (apps/proxy) — the extension
 * never calls O*NET directly. Override at build time with
 * VITE_PROXY_BASE_URL; defaults to the proxy's local dev server.
 */
export const PROXY_BASE_URL: string =
  import.meta.env.VITE_PROXY_BASE_URL ?? 'http://localhost:3000/api/onet';

/**
 * Wraps every call in a `localStorage`-backed cache and a per-install
 * self-imposed rate cap (see cachingFetch.ts) — a second, client-side layer
 * on top of the proxy's own server-side cache/rate limiter (apps/proxy/src/lib),
 * cutting real network round-trips (and load on the proxy) even further for
 * repeat lookups within one browser profile.
 */
export const onetClient = createOnetMnmClient({
  baseUrl: PROXY_BASE_URL,
  fetchImpl: createCachingFetch(),
});
