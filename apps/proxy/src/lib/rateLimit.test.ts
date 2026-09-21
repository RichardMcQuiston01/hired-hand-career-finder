import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkGlobalRateLimit, checkRateLimit, InMemoryRateLimiter } from './rateLimit';

describe('InMemoryRateLimiter', () => {
  it('allows requests up to the limit, then denies with a positive retryAfterSeconds', () => {
    const limiter = new InMemoryRateLimiter(3, 60_000);

    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.check('client-a').allowed).toBe(true);

    const denied = limiter.check('client-a');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks separate keys independently', () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);

    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.check('client-b').allowed).toBe(true);
    expect(limiter.check('client-a').allowed).toBe(false);
    expect(limiter.check('client-b').allowed).toBe(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets the window once it elapses', () => {
    vi.useFakeTimers();
    const limiter = new InMemoryRateLimiter(1, 1_000);

    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.check('client-a').allowed).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(limiter.check('client-a').allowed).toBe(true);
  });

  it('reset() clears all tracked state', () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    expect(limiter.check('client-a').allowed).toBe(true);
    expect(limiter.check('client-a').allowed).toBe(false);

    limiter.reset();

    expect(limiter.check('client-a').allowed).toBe(true);
  });
});

describe('checkRateLimit', () => {
  it('delegates to a shared default limiter', () => {
    const key = `test-client-${Math.random()}`;
    expect(checkRateLimit(key).allowed).toBe(true);
  });
});

describe('checkGlobalRateLimit', () => {
  it('delegates to a shared limiter with a single fixed key, independent of client identity', () => {
    expect(checkGlobalRateLimit().allowed).toBe(true);
  });
});
