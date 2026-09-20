import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCachingFetch } from './cachingFetch';

/** A tiny in-memory `Storage` so tests don't depend on jsdom's real localStorage state. */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('caching', () => {
  it('serves a repeat request from cache instead of calling fetch again', async () => {
    const storage = createMemoryStorage();
    const underlying = vi.fn(async () => jsonResponse({ hello: 'world' }));
    const cachingFetch = createCachingFetch(storage, underlying);

    const first = await cachingFetch('https://onet.example.test/mnm/search?keyword=nurse');
    const second = await cachingFetch('https://onet.example.test/mnm/search?keyword=nurse');

    expect(await first.json()).toEqual({ hello: 'world' });
    expect(await second.json()).toEqual({ hello: 'world' });
    expect(underlying).toHaveBeenCalledTimes(1);
  });

  it('does not cache a non-ok response', async () => {
    const storage = createMemoryStorage();
    const underlying = vi.fn(async () => jsonResponse({ error: 'nope' }, 404));
    const cachingFetch = createCachingFetch(storage, underlying);

    await cachingFetch('https://onet.example.test/mnm/careers/00-0000.00/');
    await cachingFetch('https://onet.example.test/mnm/careers/00-0000.00/');

    expect(underlying).toHaveBeenCalledTimes(2);
  });

  it('expires a default-TTL cache entry after 6 hours but keeps a question-set entry far longer', async () => {
    const storage = createMemoryStorage();
    const underlying = vi.fn(async () => jsonResponse({ ok: true }));
    const cachingFetch = createCachingFetch(storage, underlying);

    await cachingFetch('https://onet.example.test/mnm/search?keyword=nurse');
    await cachingFetch('https://onet.example.test/mnm/interestprofiler/questions_30');
    expect(underlying).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(7 * 60 * 60 * 1000); // past the 6h default TTL, well under the 30-day one

    await cachingFetch('https://onet.example.test/mnm/search?keyword=nurse');
    await cachingFetch('https://onet.example.test/mnm/interestprofiler/questions_30');

    expect(underlying).toHaveBeenCalledTimes(3); // only the search re-fetched
  });
});

describe('rate limiting', () => {
  it('refuses further calls once the per-minute budget is exhausted, without calling fetch', async () => {
    const storage = createMemoryStorage();
    const underlying = vi.fn(async () => jsonResponse({ ok: true }));
    const cachingFetch = createCachingFetch(storage, underlying);

    // Each call must be a distinct URL, or the cache would serve later ones.
    for (let i = 0; i < 20; i++) {
      const res = await cachingFetch(`https://onet.example.test/mnm/careers/${i}/`);
      expect(res.status).toBe(200);
    }
    expect(underlying).toHaveBeenCalledTimes(20);

    const refused = await cachingFetch('https://onet.example.test/mnm/careers/one-too-many/');
    expect(refused.status).toBe(429);
    expect(underlying).toHaveBeenCalledTimes(20); // the 21st call never reached fetch

    vi.advanceTimersByTime(61_000); // past the 1-minute window

    const afterReset = await cachingFetch('https://onet.example.test/mnm/careers/after-reset/');
    expect(afterReset.status).toBe(200);
    expect(underlying).toHaveBeenCalledTimes(21);
  });

  it('cache hits do not count against the rate-limit budget', async () => {
    const storage = createMemoryStorage();
    const underlying = vi.fn(async () => jsonResponse({ ok: true }));
    const cachingFetch = createCachingFetch(storage, underlying);

    await cachingFetch('https://onet.example.test/mnm/search?keyword=nurse');
    expect(underlying).toHaveBeenCalledTimes(1);

    // Far more than the 20/minute budget, but every one of these is a cache hit.
    for (let i = 0; i < 50; i++) {
      const res = await cachingFetch('https://onet.example.test/mnm/search?keyword=nurse');
      expect(res.status).toBe(200);
    }
    expect(underlying).toHaveBeenCalledTimes(1);
  });
});
