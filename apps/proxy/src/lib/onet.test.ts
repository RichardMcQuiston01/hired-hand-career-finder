import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_CAREER_SECTIONS,
  ALLOWED_INTEREST_PROFILER_SUBPATHS,
  buildUpstreamPath,
  extractUpstreamMessage,
  fetchOnet,
} from './onet';

describe('buildUpstreamPath', () => {
  it('allows /mnm/search with no extra segments', () => {
    expect(buildUpstreamPath(['mnm', 'search'])).toBe('/mnm/search');
  });

  it('rejects /mnm/search with trailing segments', () => {
    expect(buildUpstreamPath(['mnm', 'search', 'extra'])).toBeNull();
  });

  it('allows the careers listing endpoint', () => {
    expect(buildUpstreamPath(['mnm', 'careers'])).toBe('/mnm/careers/');
  });

  it('allows a career detail endpoint', () => {
    expect(buildUpstreamPath(['mnm', 'careers', '29-1141.00'])).toBe('/mnm/careers/29-1141.00/');
  });

  it('url-encodes the career code', () => {
    expect(buildUpstreamPath(['mnm', 'careers', 'a b'])).toBe('/mnm/careers/a%20b/');
  });

  it.each(ALLOWED_CAREER_SECTIONS)('allows the %s career section', (section) => {
    expect(buildUpstreamPath(['mnm', 'careers', '29-1141.00', section])).toBe(
      `/mnm/careers/29-1141.00/${section}`,
    );
  });

  it('rejects an unknown career section', () => {
    expect(buildUpstreamPath(['mnm', 'careers', '29-1141.00', 'salary'])).toBeNull();
  });

  it('rejects a career path with too many segments', () => {
    expect(buildUpstreamPath(['mnm', 'careers', '29-1141.00', 'skills', 'extra'])).toBeNull();
  });

  it('allows the interest profiler root endpoint', () => {
    expect(buildUpstreamPath(['mnm', 'interestprofiler'])).toBe('/mnm/interestprofiler/');
  });

  it.each(ALLOWED_INTEREST_PROFILER_SUBPATHS)('allows interestprofiler/%s', (sub) => {
    expect(buildUpstreamPath(['mnm', 'interestprofiler', sub])).toBe(
      `/mnm/interestprofiler/${sub}`,
    );
  });

  it('rejects an unknown interest profiler subpath', () => {
    expect(buildUpstreamPath(['mnm', 'interestprofiler', 'unknown'])).toBeNull();
  });

  it('rejects any path not rooted at /mnm', () => {
    expect(buildUpstreamPath(['online', 'search'])).toBeNull();
    expect(buildUpstreamPath(['veterans', 'search'])).toBeNull();
  });

  it('rejects an empty path', () => {
    expect(buildUpstreamPath([])).toBeNull();
  });

  it('rejects path-traversal-style segments', () => {
    expect(buildUpstreamPath(['mnm', 'careers', '..', 'skills'])).toBeNull();
    expect(buildUpstreamPath(['mnm', 'careers', '.'])).toBeNull();
  });
});

describe('fetchOnet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('calls the upstream URL and injects X-API-Key from ONET_API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('ONET_API', 'secret-key');

    const search = new URLSearchParams({ keyword: 'nurse' });
    await fetchOnet('/mnm/search', search);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api-v2.onetcenter.org/mnm/search?keyword=nurse');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('secret-key');
  });

  it('omits the X-API-Key header when ONET_API is unset', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('ONET_API', '');

    await fetchOnet('/mnm/interestprofiler/', new URLSearchParams());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-API-Key']).toBeUndefined();
  });
});

describe('extractUpstreamMessage', () => {
  it('extracts a `message` field', () => {
    expect(extractUpstreamMessage({ message: 'bad code' })).toBe('bad code');
  });

  it('extracts an `error` field', () => {
    expect(extractUpstreamMessage({ error: 'bad code' })).toBe('bad code');
  });

  it('returns a string payload as-is', () => {
    expect(extractUpstreamMessage('bad code')).toBe('bad code');
  });

  it('returns undefined for unrecognized shapes', () => {
    expect(extractUpstreamMessage({ foo: 1 })).toBeUndefined();
    expect(extractUpstreamMessage(null)).toBeUndefined();
  });
});
