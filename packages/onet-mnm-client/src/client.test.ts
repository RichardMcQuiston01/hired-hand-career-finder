import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOnetMnmClient } from './client';
import { OnetClientError } from './errors';

const BASE_URL = 'https://proxy.example.test/api/onet';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchCareers', () => {
  it('requests /mnm/search and returns the validated result', async () => {
    const searchResult = {
      start: 1,
      end: 20,
      total: 1,
      career: [
        {
          href: 'https://example.test/mnm/careers/15-1252.00/',
          code: '15-1252.00',
          title: 'Software Developers',
          tags: { bright_outlook: true },
        },
      ],
    };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/api/onet/mnm/search');
      expect(url.searchParams.get('keyword')).toBe('software');
      return jsonResponse(searchResult);
    });

    const client = createOnetMnmClient({ baseUrl: BASE_URL, fetchImpl: fetchMock as typeof fetch });
    const result = await client.searchCareers({ keyword: 'software' });

    expect(result).toEqual(searchResult);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('listCareers', () => {
  it('requests /mnm/careers with no trailing slash', async () => {
    // A trailing slash here gets 308-redirected by the proxy's Next.js
    // catch-all route, and that redirect response carries no CORS headers —
    // silently breaking every real browser call (unit tests calling a
    // mocked `fetch` can't catch this; only a real HTTP round-trip can).
    const listResult = {
      start: 1,
      end: 5,
      total: 5,
      career: [
        {
          href: 'https://example.test/mnm/careers/15-1252.00/',
          code: '15-1252.00',
          title: 'Software Developers',
        },
      ],
    };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/api/onet/mnm/careers');
      expect(url.searchParams.get('start')).toBe('1');
      expect(url.searchParams.get('end')).toBe('20');
      return jsonResponse(listResult);
    });

    const client = createOnetMnmClient({ baseUrl: BASE_URL, fetchImpl: fetchMock as typeof fetch });
    const result = await client.listCareers({ start: 1, end: 20 });

    expect(result).toEqual(listResult);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('getCareerDetail', () => {
  it('requests the section path and returns the validated detail', async () => {
    const detail = {
      code: '15-1252.00',
      title: 'Software Developers',
      element: [{ id: '2.A.1.a', related: '', name: 'Reading Comprehension', description: '...' }],
    };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/api/onet/mnm/careers/15-1252.00/skills');
      return jsonResponse(detail);
    });

    const client = createOnetMnmClient({ baseUrl: BASE_URL, fetchImpl: fetchMock as typeof fetch });
    const result = await client.getCareerDetail('15-1252.00', 'skills');

    expect(result).toEqual(detail);
  });

  it('requests the base path when no section is given', async () => {
    const detail = { code: '15-1252.00', title: 'Software Developers' };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/api/onet/mnm/careers/15-1252.00');
      return jsonResponse(detail);
    });

    const client = createOnetMnmClient({ baseUrl: BASE_URL, fetchImpl: fetchMock as typeof fetch });
    const result = await client.getCareerDetail('15-1252.00');

    expect(result).toEqual(detail);
  });
});

describe('Interest Profiler results/careers round trip', () => {
  it('fetches RIASEC results and then matched careers from those scores', async () => {
    const answers = '3'.repeat(30);
    const rawResults = {
      careers: 'https://example.test/mnm/interestprofiler/careers',
      result: [
        {
          href: 'https://example.test/x/realistic',
          code: 'realistic',
          title: 'Realistic',
          description: '',
          score: 12,
        },
        {
          href: 'https://example.test/x/investigative',
          code: 'investigative',
          title: 'Investigative',
          description: '',
          score: 18,
        },
        {
          href: 'https://example.test/x/artistic',
          code: 'artistic',
          title: 'Artistic',
          description: '',
          score: 9,
        },
        {
          href: 'https://example.test/x/social',
          code: 'social',
          title: 'Social',
          description: '',
          score: 15,
        },
        {
          href: 'https://example.test/x/enterprising',
          code: 'enterprising',
          title: 'Enterprising',
          description: '',
          score: 10,
        },
        {
          href: 'https://example.test/x/conventional',
          code: 'conventional',
          title: 'Conventional',
          description: '',
          score: 8,
        },
      ],
    };
    const flattenedResults = {
      realistic: 12,
      investigative: 18,
      artistic: 9,
      social: 15,
      enterprising: 10,
      conventional: 8,
    };
    const careers = {
      start: 1,
      end: 20,
      total: 1,
      career: [
        {
          href: 'https://example.test/mnm/careers/15-1252.00/',
          code: '15-1252.00',
          title: 'Software Developers',
          tags: { bright_outlook: true },
          fit: 'best',
        },
      ],
    };

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/onet/mnm/interestprofiler/results') {
        expect(url.searchParams.get('answers')).toBe(answers);
        return jsonResponse(rawResults);
      }
      if (url.pathname === '/api/onet/mnm/interestprofiler/careers') {
        expect(url.searchParams.get('realistic')).toBe(String(flattenedResults.realistic));
        expect(url.searchParams.get('zone')).toBeNull();
        return jsonResponse(careers);
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });

    const client = createOnetMnmClient({ baseUrl: BASE_URL, fetchImpl: fetchMock as typeof fetch });

    const riasec = await client.getInterestProfilerResults(answers);
    expect(riasec).toEqual(flattenedResults);

    const matches = await client.getInterestProfilerCareers({
      realistic: riasec.realistic,
      investigative: riasec.investigative,
      artistic: riasec.artistic,
      social: riasec.social,
      enterprising: riasec.enterprising,
      conventional: riasec.conventional,
      zone: riasec.job_zone,
    });
    expect(matches).toEqual(careers);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with a 400 OnetClientError before calling fetch when answers are malformed', async () => {
    const fetchMock = vi.fn();
    const client = createOnetMnmClient({ baseUrl: BASE_URL, fetchImpl: fetchMock as typeof fetch });

    await expect(client.getInterestProfilerResults('not-valid')).rejects.toMatchObject({
      name: 'OnetClientError',
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('non-2xx upstream responses', () => {
  it('throws an OnetClientError carrying the upstream status', async () => {
    const fetchMock = vi.fn(async () => textResponse('Occupation not found', 404));
    const client = createOnetMnmClient({ baseUrl: BASE_URL, fetchImpl: fetchMock as typeof fetch });

    await expect(client.getCareerDetail('00-0000.00')).rejects.toThrow(OnetClientError);
    await expect(client.getCareerDetail('00-0000.00')).rejects.toMatchObject({
      name: 'OnetClientError',
      status: 404,
      message: 'Occupation not found',
    });
  });
});

describe('schema validation failures', () => {
  it('throws instead of returning data that fails validation', async () => {
    const malformed = {
      start: 1,
      end: 20,
      // "total" is missing and "career" is not an array — should fail
      // careerSearchResultSchema rather than being returned as-is.
      career: 'not-an-array',
    };
    const fetchMock = vi.fn(async () => jsonResponse(malformed));
    const client = createOnetMnmClient({ baseUrl: BASE_URL, fetchImpl: fetchMock as typeof fetch });

    await expect(client.searchCareers({ keyword: 'software' })).rejects.toThrow(OnetClientError);
    await expect(client.searchCareers({ keyword: 'software' })).rejects.toMatchObject({
      name: 'OnetClientError',
      status: 502,
    });
  });

  it('rejects an Interest Profiler results response missing a RIASEC score', async () => {
    const missingConventional = {
      careers: 'https://example.test/mnm/interestprofiler/careers',
      result: [
        { href: 'x', code: 'realistic', title: 'Realistic', description: '', score: 12 },
        { href: 'x', code: 'investigative', title: 'Investigative', description: '', score: 18 },
        { href: 'x', code: 'artistic', title: 'Artistic', description: '', score: 9 },
        { href: 'x', code: 'social', title: 'Social', description: '', score: 15 },
        { href: 'x', code: 'enterprising', title: 'Enterprising', description: '', score: 10 },
      ],
    };
    const fetchMock = vi.fn(async () => jsonResponse(missingConventional));
    const client = createOnetMnmClient({ baseUrl: BASE_URL, fetchImpl: fetchMock as typeof fetch });

    await expect(client.getInterestProfilerResults('3'.repeat(30))).rejects.toMatchObject({
      name: 'OnetClientError',
      status: 502,
    });
  });
});
