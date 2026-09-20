import { NextResponse, type NextRequest } from 'next/server';
import { applyCorsHeaders, applyPreflightCorsHeaders, resolveCorsOrigin } from '@/lib/cors';
import { buildUpstreamPath, extractUpstreamMessage, fetchOnet } from '@/lib/onet';
import { checkRateLimit } from '@/lib/rateLimit';

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

  const rateLimit = checkRateLimit(clientKeyFor(request));
  if (!rateLimit.allowed) {
    const headers = new Headers();
    if (corsOrigin) applyCorsHeaders(headers, corsOrigin);
    if (rateLimit.retryAfterSeconds !== undefined) {
      headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
    }
    return NextResponse.json(errorBody(429, 'Too many requests. Please try again shortly.'), {
      status: 429,
      headers,
    });
  }

  const { path } = await context.params;
  const upstreamPath = buildUpstreamPath(path ?? []);
  if (upstreamPath === null) {
    return errorResponse(404, 'This endpoint is not exposed by this proxy.', corsOrigin);
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

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (corsOrigin) applyCorsHeaders(headers, corsOrigin);
  return new NextResponse(JSON.stringify(payload), { status: upstreamResponse.status, headers });
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
