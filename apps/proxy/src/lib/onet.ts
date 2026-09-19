/**
 * Allow-listed O*NET Web Services `/mnm` proxying.
 *
 * This module is the single place that decides which upstream O*NET paths
 * this proxy will forward to, and how it talks to the upstream API. Nothing
 * here ever forwards a caller-supplied `X-API-Key` header — the key is
 * injected here from `process.env.ONET_API` and nowhere else, so a caller
 * can never supply or override it.
 */

/** Base URL for the O*NET Web Services v2 API. */
export const ONET_BASE_URL = 'https://api-v2.onetcenter.org';

/**
 * The only career-detail sections this proxy will forward, per the O*NET
 * `/mnm/careers/{code}/{section}` endpoints this extension uses.
 */
export const ALLOWED_CAREER_SECTIONS = [
  'skills',
  'knowledge',
  'abilities',
  'personality',
  'education',
  'job_outlook',
  'technology',
  'explore_more',
  'check_out_my_state',
] as const;

/** The only `/mnm/interestprofiler/{sub}` endpoints this proxy will forward. */
export const ALLOWED_INTEREST_PROFILER_SUBPATHS = [
  'questions',
  'questions_30',
  'job_zones',
  'results',
  'careers',
] as const;

/**
 * Validates a raw path segment that will be interpolated into the upstream
 * URL (e.g. a career code). Rejects anything empty, `.`/`..`, or containing
 * a literal slash — the segment must be a single decoded path component.
 */
function isSafeSegment(segment: string | undefined): segment is string {
  if (!segment) return false;
  if (segment === '.' || segment === '..') return false;
  if (segment.includes('/')) return false;
  return true;
}

/**
 * Maps a caller-requested path (the dynamic `path` segments from the
 * catch-all route, e.g. `['mnm', 'careers', '29-1141.00', 'skills']`) to the
 * exact upstream O*NET path, or `null` if the request does not match the
 * fixed allow-list of endpoints this proxy exposes.
 *
 * This is the proxy's only gate against becoming an open relay: every path
 * this function does not explicitly recognize is rejected, regardless of
 * how plausible it looks.
 */
export function buildUpstreamPath(segments: readonly string[]): string | null {
  if (segments.length === 0 || segments[0] !== 'mnm') return null;
  const rest = segments.slice(1);
  if (rest.length === 0 || !rest.every((segment) => isSafeSegment(segment))) return null;

  const [head, ...tail] = rest;

  switch (head) {
    case 'search':
      return tail.length === 0 ? '/mnm/search' : null;

    case 'careers': {
      if (tail.length === 0) return '/mnm/careers/';
      const [code, section] = tail;
      if (tail.length === 1) return `/mnm/careers/${encodeURIComponent(code!)}/`;
      if (tail.length === 2 && (ALLOWED_CAREER_SECTIONS as readonly string[]).includes(section!)) {
        return `/mnm/careers/${encodeURIComponent(code!)}/${section}`;
      }
      return null;
    }

    case 'interestprofiler': {
      if (tail.length === 0) return '/mnm/interestprofiler/';
      if (
        tail.length === 1 &&
        (ALLOWED_INTEREST_PROFILER_SUBPATHS as readonly string[]).includes(tail[0]!)
      ) {
        return `/mnm/interestprofiler/${tail[0]}`;
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Calls the upstream O*NET API for an already-validated upstream path,
 * injecting the real API key server-side. Never forwards any header from
 * the incoming request.
 */
export async function fetchOnet(upstreamPath: string, search: URLSearchParams): Promise<Response> {
  const query = search.toString();
  const url = `${ONET_BASE_URL}${upstreamPath}${query ? `?${query}` : ''}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = process.env.ONET_API;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  return fetch(url, { method: 'GET', headers });
}

/** Best-effort extraction of a human-readable message from an upstream error body. */
export function extractUpstreamMessage(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  if (typeof payload === 'string' && payload.trim().length > 0) return payload;
  return undefined;
}
