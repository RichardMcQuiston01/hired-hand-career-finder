/**
 * CORS policy for the O*NET proxy: only Chrome extension origins may call
 * this API, and in production only ones on an explicit allow-list.
 */

const ALLOWED_METHODS = 'GET, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type';

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * Decides whether `originHeader` may receive a CORS-enabled response, and
 * returns the exact origin to echo back in `Access-Control-Allow-Origin`
 * (never `*`) — or `null` if the origin is not allowed.
 *
 * - Only `chrome-extension://` origins are ever allowed.
 * - In production (`NODE_ENV === 'production'`), the origin must also be in
 *   the comma-separated `ALLOWED_EXTENSION_ORIGINS` env var.
 * - Outside production, any `chrome-extension://` origin is allowed (there
 *   is no fixed extension ID yet during local development), and a warning
 *   is logged so this permissive behavior is never silently mistaken for
 *   the production policy.
 */
export function resolveCorsOrigin(originHeader: string | null): string | null {
  if (!originHeader || !originHeader.startsWith('chrome-extension://')) {
    return null;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.warn(
      `[proxy] CORS: NODE_ENV is not "production" — allowing any chrome-extension:// origin ` +
        `(got "${originHeader}"). This must never happen in a production deployment.`,
    );
    return originHeader;
  }

  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_EXTENSION_ORIGINS);
  return allowedOrigins.includes(originHeader) ? originHeader : null;
}

/** Applies the CORS headers for an actual (non-preflight) response. */
export function applyCorsHeaders(headers: Headers, allowedOrigin: string): void {
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Vary', 'Origin');
}

/** Applies the CORS headers for an `OPTIONS` preflight response. */
export function applyPreflightCorsHeaders(headers: Headers, allowedOrigin: string): void {
  applyCorsHeaders(headers, allowedOrigin);
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
}
