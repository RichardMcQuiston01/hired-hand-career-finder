import type { Page } from '@playwright/test';

/**
 * Stubs just enough of the `chrome.*` extension API surface for the built
 * pages to run in a plain browser tab (not a real loaded/unpacked
 * extension) without crashing: `chrome.runtime.getManifest()` (read by the
 * Options page) and `chrome.storage.session` (read/written by
 * `InterestProfilerPanel` to persist in-progress answers).
 *
 * Call this before `page.goto(...)` for every side panel test.
 */
export async function installChromeStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const sessionStore: Record<string, unknown> = {};

    function readKeys(store: Record<string, unknown>, keys: unknown): Record<string, unknown> {
      if (keys == null) {
        return { ...store };
      }
      const result: Record<string, unknown> = {};
      if (typeof keys === 'string') {
        result[keys] = store[keys];
        return result;
      }
      if (Array.isArray(keys)) {
        for (const key of keys as string[]) result[key] = store[key];
        return result;
      }
      for (const key of Object.keys(keys as Record<string, unknown>)) {
        result[key] = key in store ? store[key] : (keys as Record<string, unknown>)[key];
      }
      return result;
    }

    (window as unknown as { chrome: unknown }).chrome = {
      runtime: {
        getManifest: () => ({ name: 'Hired Hand: Career Finder', version: '0.1.0-e2e' }),
      },
      storage: {
        session: {
          get: (keys: unknown) => Promise.resolve(readKeys(sessionStore, keys)),
          set: (items: Record<string, unknown>) => {
            Object.assign(sessionStore, items);
            return Promise.resolve();
          },
          remove: (keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete sessionStore[key];
            return Promise.resolve();
          },
        },
      },
    };
  });
}
