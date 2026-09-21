import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, readCache, writeCache } from './cache';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  clearCache();
});

describe('readCache / writeCache', () => {
  it('returns undefined for a key that was never written', () => {
    expect(readCache('/mnm/search?keyword=nurse')).toBeUndefined();
  });

  it('returns what was written, until it expires', () => {
    writeCache('/mnm/search?keyword=nurse', 200, '{"ok":true}');

    expect(readCache('/mnm/search?keyword=nurse')).toEqual({
      status: 200,
      body: '{"ok":true}',
      cachedAt: expect.any(Number),
    });

    vi.advanceTimersByTime(7 * 60 * 60 * 1000); // past the 6h default TTL

    expect(readCache('/mnm/search?keyword=nurse')).toBeUndefined();
  });

  it('keeps an interest-profiler question-set entry far longer than the default TTL', () => {
    writeCache('/mnm/interestprofiler/questions_30?', 200, '{"question":[]}');

    vi.advanceTimersByTime(7 * 60 * 60 * 1000); // past the 6h default TTL, well under 30 days

    expect(readCache('/mnm/interestprofiler/questions_30?')).toBeDefined();
  });

  it('clearCache() drops all entries', () => {
    writeCache('/mnm/search?keyword=nurse', 200, '{"ok":true}');
    clearCache();
    expect(readCache('/mnm/search?keyword=nurse')).toBeUndefined();
  });
});
