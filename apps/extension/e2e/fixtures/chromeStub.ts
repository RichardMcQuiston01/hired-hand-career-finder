import type { Page } from '@playwright/test';

export interface ChromeStubOptions {
  /**
   * Pre-seed an ExtensionPay API key in the stubbed `chrome.storage.local`
   * so `ExtPay(...).getUser()` makes a (mocked, via `installExtPayMocks`)
   * network call instead of resolving `paid: false` locally. Omit for the
   * default unpaid state, which never touches the network at all.
   */
  extPayApiKeySeed?: string;
}

/**
 * Stubs just enough of the `chrome.*` extension API surface for the built
 * pages to run in a plain browser tab (not a real loaded/unpacked
 * extension) without crashing.
 *
 * This matters everywhere, not just for ExtensionPay-specific tests:
 * `webextension-polyfill` (a dependency of the `extpay` package) throws
 * *at module evaluation time* — `This script should only be loaded in a
 * browser extension.` — unless `chrome.runtime.id` already exists. The side
 * panel's module graph reaches it eagerly (`sidepanel` bundle -> app ->
 * InterestProfilerPanel -> ExportResults -> `lib/extpay` -> `extpay` ->
 * `webextension-polyfill`), so without this stub in place *before* the page
 * loads, every side panel test — not only the ones that render
 * `ExportResults` — would crash on load. Confirmed by inspecting the built
 * `dist/src/sidepanel/index.html`, which `modulepreload`s the `extpay`
 * chunk unconditionally.
 *
 * Call this before `page.goto(...)` for every side panel test.
 */
export async function installChromeStub(
  page: Page,
  options: ChromeStubOptions = {},
): Promise<void> {
  await page.addInitScript((opts: ChromeStubOptions) => {
    const localStore: Record<string, unknown> = {};
    if (opts.extPayApiKeySeed) {
      localStore.extensionpay_api_key = opts.extPayApiKeySeed;
      localStore.extensionpay_installed_at = new Date('2024-01-01T00:00:00.000Z').toISOString();
    }
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
        id: 'hired-hand-e2e-test',
        getManifest: () => ({ name: 'Hired Hand: Career Finder', version: '0.1.0-e2e' }),
        sendMessage: (_message: unknown, callback?: (response: unknown) => void) => {
          callback?.(undefined);
        },
        onMessage: { addListener: () => undefined },
      },
      storage: {
        // Dual-mode, like real MV3 `chrome.storage.local`: callback-style
        // when a callback is passed (what `webextension-polyfill`, used by
        // the `extpay` package, expects to wrap into a promise itself) and
        // Promise-returning when it isn't (observed in practice: this
        // build's `webextension-polyfill` calls `local.get`/`set` with no
        // injected callback at all, so a callback-only implementation would
        // never resolve).
        local: {
          get: (keys: unknown, callback?: (result: Record<string, unknown>) => void) => {
            const result = readKeys(localStore, keys);
            if (typeof callback === 'function') {
              callback(result);
              return undefined;
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>, callback?: () => void) => {
            Object.assign(localStore, items);
            if (typeof callback === 'function') {
              callback();
              return undefined;
            }
            return Promise.resolve();
          },
          remove: (keys: string | string[], callback?: () => void) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete localStore[key];
            if (typeof callback === 'function') {
              callback();
              return undefined;
            }
            return Promise.resolve();
          },
        },
        // Promise-style: `InterestProfilerPanel.tsx` calls the real MV3
        // `chrome.storage.session` API directly (no callback argument).
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
  }, options);
}
