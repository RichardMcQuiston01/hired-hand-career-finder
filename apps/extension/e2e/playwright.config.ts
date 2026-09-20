import { defineConfig, devices } from '@playwright/test';

/**
 * Whole-page E2E accessibility layer, separate from the Vitest + jest-axe
 * unit tests (which scan isolated components). This layer scans the fully
 * assembled Side Panel and Options pages — the only place cross-component
 * issues (duplicate ids, landmark structure, real tab order) would show up.
 *
 * `webServer` builds nothing itself (the build's asset paths are
 * root-absolute, e.g. `/assets/...`, `/src/sidepanel/index.html`) — run
 * `npm run build` first (see the `pretest:e2e` script in package.json), then
 * this starts `vite preview` against `apps/extension/dist` and waits for it.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    cwd: '..',
    url: 'http://localhost:4173/src/sidepanel/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
