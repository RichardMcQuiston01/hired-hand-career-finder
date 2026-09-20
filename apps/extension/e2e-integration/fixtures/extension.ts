import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Loads the *real* built, unpacked extension (`apps/extension/dist`) into a
 * real Chromium persistent context — not a `vite preview` tab with a
 * `chrome.*` stub (that's the Stage 4 `apps/extension/e2e/` layer). This
 * gets a real `chrome.runtime`, a real background service worker, and a
 * real `chrome-extension://` origin, so `extpay` (which throws at
 * module-load time without a genuine `chrome.runtime.id`) and
 * `chrome.storage`/`chrome.runtime.getManifest()` all run unmodified,
 * exactly as they would once installed.
 *
 * Chromium only loads unpacked extensions via `launchPersistentContext`
 * (there is no non-persistent equivalent), and only in Chromium — Playwright
 * has no Firefox/WebKit extension support. `headless: false` here is
 * deliberate, not a mistake: Playwright's own `headless: true` transparently
 * substitutes the stripped-down "headless shell" Chromium build, which does
 * not support extensions at all (the background service worker silently
 * never registers). The documented way to run extension tests headlessly is
 * to keep `headless: false` (so Playwright doesn't make that substitution)
 * and instead pass Chromium's own `--headless=new` flag, which runs the
 * *full* Chromium binary in its real headless mode.
 */
export const EXTENSION_DIST_PATH = resolve(__dirname, '../../dist');

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  page: Page;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      // See the class comment above — this is intentional, not `true`.
      headless: false,
      // No explicit `executablePath`: let Playwright resolve whichever
      // Chromium it (or `npx playwright install`) put in place — this
      // sandbox sets `PLAYWRIGHT_BROWSERS_PATH`, CI installs to Playwright's
      // own default cache dir (see the `Install Playwright browsers` CI
      // step), and hardcoding either path breaks the other.
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXTENSION_DIST_PATH}`,
        `--load-extension=${EXTENSION_DIST_PATH}`,
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
    }
    const extensionId = new URL(serviceWorker.url()).host;
    await use(extensionId);
  },

  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;
