import { createOnetMnmClient } from '@hired-hand/onet-mnm-client';

/**
 * Base URL of this project's O*NET API proxy (apps/proxy) — the extension
 * never calls O*NET directly. Override at build time with
 * VITE_PROXY_BASE_URL; defaults to the proxy's local dev server.
 */
export const PROXY_BASE_URL: string =
  import.meta.env.VITE_PROXY_BASE_URL ?? 'http://localhost:3000/api/onet';

export const onetClient = createOnetMnmClient({ baseUrl: PROXY_BASE_URL });
