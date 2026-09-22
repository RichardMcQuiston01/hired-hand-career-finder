import { defineConfig } from '@playwright/test';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { E2E_ONET_API_KEY, MOCK_ONET_PORT, PROXY_PORT } from './fixtures/constants';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROXY_DIR = resolve(__dirname, '../../proxy');

/**
 * Stage 6 (`docs/DEVELOPMENT_PLAN.md`) staging integration layer — distinct
 * from the Stage 4 `apps/extension/e2e/` whole-page a11y suite, which mocks
 * `chrome.*` and `onetClient` network calls at the `page.route` level inside
 * a plain `vite preview` tab. This suite instead:
 *
 *   - loads the real built, unpacked extension into a real Chromium
 *     extension context (see `fixtures/extension.ts`) — real
 *     `chrome.runtime`/`chrome.storage` and a real background service
 *     worker, instead of the Stage 4 stub;
 *   - runs the real `apps/proxy` Next.js server (not a mocked route handler)
 *     against a local fixture server standing in for the real O*NET API
 *     (`fixtures/mock-onet-server.mjs`), since this sandbox cannot reach
 *     `api-v2.onetcenter.org` — see that file's own comment and
 *     `apps/proxy/README.md`'s "Live verification" note. Everything up to
 *     that last hop (key injection, CORS, allow-list, the extension's own
 *     network calls) is exercised for real.
 *
 * `apps/extension/dist` must be built first (see the `pretest` script in
 * `package.json`) — the extension is loaded from disk, not served over HTTP.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false, // one shared proxy/mock-server pair; avoid cross-test interference.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  use: {
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-extension' }],
  webServer: [
    {
      command: `node fixtures/mock-onet-server.mjs`,
      cwd: __dirname,
      env: {
        MOCK_ONET_PORT: String(MOCK_ONET_PORT),
        EXPECTED_API_KEY: E2E_ONET_API_KEY,
      },
      url: `http://127.0.0.1:${MOCK_ONET_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: 'npm run dev',
      cwd: PROXY_DIR,
      env: {
        PORT: String(PROXY_PORT),
        ONET_API: E2E_ONET_API_KEY,
        ONET_BASE_URL: `http://127.0.0.1:${MOCK_ONET_PORT}`,
      },
      url: `http://127.0.0.1:${PROXY_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
