import { defineConfig } from '@playwright/test';

/**
 * Stage 6 (`docs/DEVELOPMENT_PLAN.md`) staging integration layer — distinct
 * from the Stage 4 `apps/extension/e2e/` whole-page a11y suite, which loads
 * pages over HTTP via `vite preview` with a `chrome.*` stub standing in for
 * a real extension. This suite loads the real built, unpacked extension
 * into a real Chromium extension context instead (see
 * `fixtures/extension.ts`) — real `chrome.runtime`/`chrome.storage`, a real
 * background service worker, so `extpay` runs unmodified rather than being
 * stubbed.
 *
 * There is no backend in this architecture (see
 * docs/DEVELOPMENT_PLAN.md's "Key decisions" section) — the extension calls
 * O*NET's real API directly — so unlike an earlier version of this suite,
 * there is nothing to run as a `webServer` here: no server-side code exists
 * to exercise. Network calls to O*NET are mocked with `page.route()`,
 * reusing the same fixtures the Stage 4 suite uses
 * (`apps/extension/e2e/fixtures/mockData.ts`), since a real live call to
 * `api-v2.onetcenter.org` isn't reachable from this sandbox (or safe to
 * depend on in CI without a provisioned key).
 *
 * `apps/extension/dist` must be built first (see the `pretest` script in
 * `package.json`) — the extension is loaded from disk, not served over HTTP.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  use: {
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-extension' }],
});
