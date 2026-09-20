import { NextResponse, type NextRequest } from 'next/server';
import { readCache, writeCache } from '@/lib/cache';
import { applyCorsHeaders, applyPreflightCorsHeaders, resolveCorsOrigin } from '@/lib/cors';
import { buildUpstreamPath, extractUpstreamMessage, fetchOnet } from '@/lib/onet';
import { checkGlobalRateLimit, checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

interface NormalizedError {
  error: {
    status: number;
    message: string;
  };
}

function errorBody(status: number, message: string): NormalizedError {
  return { error: { status, message } };
}

function errorResponse(status: number, message: string, corsOrigin: string | null): NextResponse {
  const headers = new Headers();
  if (corsOrigin) applyCorsHeaders(headers, corsOrigin);
  return NextResponse.json(errorBody(status, message), { status, headers });
}

/** First hop from `x-forwarded-for`, or a fallback key when it's absent (e.g. local dev). */
function clientKeyFor(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const firstHop = forwardedFor?.split(',')[0]?.trim();
  return firstHop && firstHop.length > 0 ? firstHop : 'unknown';
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const originHeader = request.headers.get('origin');
  let corsOrigin: string | null = null;
  if (originHeader !== null) {
    corsOrigin = resolveCorsOrigin(originHeader);
    if (corsOrigin === null) {
      return errorResponse(403, 'This origin is not permitted to use this API.', null);
    }
  }

  const { path } = await context.params;
  const upstreamPath = buildUpstreamPath(path ?? []);
  if (upstreamPath === null) {
    return errorResponse(404, 'This endpoint is not exposed by this proxy.', corsOrigin);
  }

  // Cached responses skip both rate limiters entirely — a cache hit never
  // touches the upstream O*NET API, so it shouldn't count against either
  // budget. See cache.ts: shared across every client since this proxy runs
  // as a single process, not per-instance like the rate limiters' own
  // documented multi-instance caveat.
  const cacheKey = `${upstreamPath}?${request.nextUrl.searchParams.toString()}`;
  const cached = readCache(cacheKey);
  if (cached) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (corsOrigin) applyCorsHeaders(headers, corsOrigin);
    return new NextResponse(cached.body, { status: cached.status, headers });
  }

  const rateLimit = checkRateLimit(clientKeyFor(request));
  const globalRateLimit = checkGlobalRateLimit();
  const deniedBy = !rateLimit.allowed
    ? rateLimit
    : !globalRateLimit.allowed
      ? globalRateLimit
      : null;
  if (deniedBy) {
    const headers = new Headers();
    if (corsOrigin) applyCorsHeaders(headers, corsOrigin);
    if (deniedBy.retryAfterSeconds !== undefined) {
      headers.set('Retry-After', String(deniedBy.retryAfterSeconds));
    }
    return NextResponse.json(errorBody(429, 'Too many requests. Please try again shortly.'), {
      status: 429,
      headers,
    });
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchOnet(upstreamPath, request.nextUrl.searchParams);
  } catch {
    return errorResponse(502, 'Failed to reach the O*NET Web Services API.', corsOrigin);
  }

  const rawBody = await upstreamResponse.text();
  let payload: unknown = null;
  if (rawBody.length > 0) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = rawBody;
    }
  }

  if (!upstreamResponse.ok) {
    const message =
      extractUpstreamMessage(payload) ??
      upstreamResponse.statusText ??
      'The O*NET Web Services API returned an error.';
    return errorResponse(upstreamResponse.status, message, corsOrigin);
  }

  const responseBody = JSON.stringify(payload);
  writeCache(cacheKey, upstreamResponse.status, responseBody);

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (corsOrigin) applyCorsHeaders(headers, corsOrigin);
  return new NextResponse(responseBody, { status: upstreamResponse.status, headers });
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const originHeader = request.headers.get('origin');
  const corsOrigin = originHeader !== null ? resolveCorsOrigin(originHeader) : null;

  if (corsOrigin === null) {
    return new NextResponse(null, { status: 403 });
  }

  const headers = new Headers();
  applyPreflightCorsHeaders(headers, corsOrigin);
  return new NextResponse(null, { status: 204, headers });
}
