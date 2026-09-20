import { createOnetMnmClient } from '@hired-hand/onet-mnm-client';
import { createCachingFetch } from './cachingFetch';

/**
 * The extension calls O*NET's Web Services API directly — there is no
 * backend proxy (see docs/DEVELOPMENT_PLAN.md's "Key decisions" section).
 * `VITE_ONET_BASE_URL` exists only so tests/local dev can point this at a
 * fixture server instead of the real API; production builds should never
 * set it.
 */
export const ONET_BASE_URL: string =
  import.meta.env.VITE_ONET_BASE_URL ?? 'https://api-v2.onetcenter.org';

/**
 * Baked into the build at compile time (see `.github/workflows/release.yml`
 * and README for local dev setup) — never committed. Not treated as a
 * secret (see docs/DEVELOPMENT_PLAN.md), so it's fine for this to ship
 * inside the extension's inspectable bundle.
 */
export const ONET_API_KEY: string | undefined = import.meta.env.VITE_ONET_API_KEY;

export const onetClient = createOnetMnmClient({
  baseUrl: ONET_BASE_URL,
  apiKey: ONET_API_KEY,
  fetchImpl: createCachingFetch(),
});
