import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rateLimit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rateLimit')>();
  return {
    ...actual,
    checkRateLimit: vi.fn(actual.checkRateLimit),
  };
});

import { checkRateLimit } from '@/lib/rateLimit';
import { GET, OPTIONS } from './route';

const DEV_EXTENSION_ORIGIN = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function makeRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

function paramsFor(path: string[]): { params: Promise<{ path?: string[] }> } {
  return { params: Promise.resolve({ path }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.mocked(checkRateLimit).mockClear();
});

describe('GET /api/onet/[...path]', () => {
  it('proxies a valid request to the upstream O*NET API and forwards the JSON body', async () => {
    vi.stubEnv('ONET_API', 'secret-key');
    const upstreamBody = { occupations: [{ code: '29-1141.00', title: 'Registered Nurses' }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(upstreamBody), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const request = makeRequest('https://proxy.example.com/api/onet/mnm/search?keyword=nurse', {
      origin: DEV_EXTENSION_ORIGIN,
    });

    const response = await GET(request, paramsFor(['mnm', 'search']));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(upstreamBody);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(DEV_EXTENSION_ORIGIN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api-v2.onetcenter.org/mnm/search?keyword=nurse');
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('secret-key');
  });

  it('normalizes an upstream error response and passes its status through', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unknown occupation code' }), {
        status: 404,
        statusText: 'Not Found',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = makeRequest('https://proxy.example.com/api/onet/mnm/careers/00-0000.00/', {
      origin: DEV_EXTENSION_ORIGIN,
    });

    const response = await GET(request, paramsFor(['mnm', 'careers', '00-0000.00']));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { status: 404, message: 'Unknown occupation code' },
    });
  });

  it('returns a normalized 502 when the upstream API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND api-v2.onetcenter.org')),
    );

    const request = makeRequest('https://proxy.example.com/api/onet/mnm/search?keyword=nurse', {
      origin: DEV_EXTENSION_ORIGIN,
    });

    const response = await GET(request, paramsFor(['mnm', 'search']));

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.status).toBe(502);
  });

  it('rejects a path that is not on the allow-list, without calling upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = makeRequest('https://proxy.example.com/api/onet/mnm/veterans/anything', {
      origin: DEV_EXTENSION_ORIGIN,
    });

    const response = await GET(request, paramsFor(['mnm', 'veterans', 'anything']));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a disallowed CORS origin without calling upstream', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ALLOWED_EXTENSION_ORIGINS', DEV_EXTENSION_ORIGIN);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = makeRequest('https://proxy.example.com/api/onet/mnm/search?keyword=nurse', {
      origin: 'https://not-the-extension.example.com',
    });

    const response = await GET(request, paramsFor(['mnm', 'search']));

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('returns 429 with Retry-After once the rate limiter denies the request', async () => {
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, retryAfterSeconds: 7 });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = makeRequest('https://proxy.example.com/api/onet/mnm/search?keyword=nurse', {
      origin: DEV_EXTENSION_ORIGIN,
    });

    const response = await GET(request, paramsFor(['mnm', 'search']));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('7');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('OPTIONS /api/onet/[...path]', () => {
  it('answers a preflight from an allowed chrome-extension origin', async () => {
    const request = makeRequest('https://proxy.example.com/api/onet/mnm/search', {
      origin: DEV_EXTENSION_ORIGIN,
    });

    const response = await OPTIONS(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(DEV_EXTENSION_ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('rejects a preflight from a disallowed origin', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ALLOWED_EXTENSION_ORIGINS', DEV_EXTENSION_ORIGIN);

    const request = makeRequest('https://proxy.example.com/api/onet/mnm/search', {
      origin: 'https://evil.example.com',
    });

    const response = await OPTIONS(request);

    expect(response.status).toBe(403);
  });
});
