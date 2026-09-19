import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCorsHeaders, applyPreflightCorsHeaders, resolveCorsOrigin } from './cors';

describe('resolveCorsOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects a null origin', () => {
    expect(resolveCorsOrigin(null)).toBeNull();
  });

  it('rejects any non chrome-extension origin, even in dev mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(resolveCorsOrigin('https://evil.example.com')).toBeNull();
  });

  it('in production, allows only origins on ALLOWED_EXTENSION_ORIGINS', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(
      'ALLOWED_EXTENSION_ORIGINS',
      'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );

    expect(resolveCorsOrigin('chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(
      'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(resolveCorsOrigin('chrome-extension://zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBeNull();
  });

  it('in production, rejects everything when the allow-list is unset', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ALLOWED_EXTENSION_ORIGINS', '');
    expect(resolveCorsOrigin('chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull();
  });

  it('outside production, allows any chrome-extension origin and logs a warning', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(resolveCorsOrigin('chrome-extension://anything-during-dev')).toBe(
      'chrome-extension://anything-during-dev',
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('applyCorsHeaders', () => {
  it('sets Access-Control-Allow-Origin to the exact origin, never a wildcard', () => {
    const headers = new Headers();
    applyCorsHeaders(headers, 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(headers.get('Access-Control-Allow-Origin')).toBe(
      'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(headers.get('Vary')).toBe('Origin');
  });
});

describe('applyPreflightCorsHeaders', () => {
  it('also sets allowed methods and headers', () => {
    const headers = new Headers();
    applyPreflightCorsHeaders(headers, 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(headers.get('Access-Control-Allow-Headers')).toBeTruthy();
  });
});
