/**
 * Stage 6 staging integration suite — see `playwright.config.ts`'s top
 * comment for what makes this different from the Stage 4 `apps/extension/e2e/`
 * layer (a real extension in a real Chromium extension context, rather than
 * a `vite preview` tab with a `chrome.*` stub). O*NET itself is mocked via
 * `page.route()` here too, same as Stage 4 — this sandbox can't reach the
 * real API, and CI shouldn't depend on a live third-party call to stay
 * green — but the extension's own real chrome.runtime/chrome.storage,
 * background service worker, and `localStorage` caching/rate-limit layer
 * all run completely unmocked.
 */
import { test, expect } from './fixtures/extension';
import { installOnetMocks } from '../e2e/fixtures/mockOnet';
import { completeShortAssessment } from '../e2e/fixtures/interestProfiler';

/**
 * Baked into the build by `pretest:e2e-integration` in package.json — kept
 * in sync by hand with that script. A distinctive, obviously-fake value so
 * a mismatch is easy to spot.
 */
const E2E_ONET_API_KEY = 'e2e-test-key-not-a-real-secret';

function sidePanelUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/src/sidepanel/index.html`;
}

function optionsUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/src/options/index.html`;
}

test('extension loads with a real chrome-extension:// origin and manifest', async ({
  page,
  extensionId,
}) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
  await installOnetMocks(page);
  await page.goto(sidePanelUrl(extensionId));
  await expect(page).toHaveTitle('Hired Hand: Career Finder');
  await expect(page.getByRole('tab', { name: 'Search', selected: true })).toBeVisible();
});

test('Career Search: calls O*NET directly with the built-in API key', async ({
  page,
  extensionId,
}) => {
  // A passive observer, not a route handler — this doesn't need to resolve
  // anything, so it can't interfere with `installOnetMocks`'s own routing.
  const apiKeysSent: (string | null)[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('https://api-v2.onetcenter.org/')) {
      apiKeysSent.push(request.headers()['x-api-key'] ?? null);
    }
  });
  await installOnetMocks(page);

  await page.goto(sidePanelUrl(extensionId));
  await page.getByPlaceholder('Search careers, e.g. nurse').fill('nurse');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('3 results for "nurse"')).toBeVisible();
  await expect(page.getByTitle('Bright Outlook')).toBeVisible();

  expect(apiKeysSent.length).toBeGreaterThan(0);
  expect(apiKeysSent.every((key) => key === E2E_ONET_API_KEY)).toBe(true);
});

test('Browse Careers: list + detail load through a real extension-context fetch', async ({
  page,
  extensionId,
}) => {
  await installOnetMocks(page);
  await page.goto(sidePanelUrl(extensionId));
  await page.getByRole('tab', { name: 'Browse' }).click();
  await expect(page.getByText('Showing careers 1–5 of 5.')).toBeVisible();
  await expect(page.getByLabel('Bright Outlook career')).toBeVisible();

  await page.getByRole('button', { name: /Software Developers/ }).click();
  await expect(page.getByRole('heading', { name: 'Software Developers' })).toBeVisible();

  await page.getByRole('button', { name: 'Skills' }).click();
  await expect(page.getByText('Critical Thinking')).toBeVisible();
});

test('repeat identical requests are served from the localStorage cache, not the network', async ({
  page,
  extensionId,
}) => {
  // A passive observer, not a route handler — see the API-key test above
  // for why this doesn't compete with installOnetMocks's own routing.
  let searchRequestCount = 0;
  page.on('request', (request) => {
    if (request.url().includes('/mnm/search')) searchRequestCount += 1;
  });
  await installOnetMocks(page);

  await page.goto(sidePanelUrl(extensionId));
  const input = page.getByPlaceholder('Search careers, e.g. nurse');
  const searchButton = page.getByRole('button', { name: 'Search' });

  await input.fill('nurse');
  await searchButton.click();
  await expect(page.getByText('3 results for "nurse"')).toBeVisible();
  expect(searchRequestCount).toBe(1);

  // Same query again — cachingFetch.ts should serve this from localStorage
  // without a second network request.
  await input.fill('');
  await input.fill('nurse');
  await searchButton.click();
  await expect(page.getByText('3 results for "nurse"')).toBeVisible();
  expect(searchRequestCount).toBe(1);
});

test('Interest Profiler: complete the short form end-to-end', async ({ page, extensionId }) => {
  await installOnetMocks(page);
  await page.goto(sidePanelUrl(extensionId));
  await page.getByRole('tab', { name: 'Interest Profiler' }).click();

  await completeShortAssessment(page);

  await expect(page.getByText('Registered Nurses')).toBeVisible();

  // Real ExtensionPay client in a real extension context (not the Stage 4
  // chrome-stub) — extensionpay.com is unreachable from this sandbox.
  // Verified this degrades gracefully to the unpaid state rather than
  // hanging or crashing the panel: `extpay.getUser()` resolves locally
  // rather than throwing when its network call fails, so the real paywall
  // UI renders normally.
  await expect(
    page.getByText('Export your results as CSV or PDF with a one-time upgrade.'),
  ).toBeVisible();
});

test('Options page: donate link is real and About reads the real manifest', async ({
  page,
  extensionId,
}) => {
  await page.goto(optionsUrl(extensionId));
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible();

  // Real chrome.runtime.getManifest() this time, not the jsdom-safe fallback.
  await expect(page.getByText('0.1.0')).toBeVisible();

  const donateLink = page.getByRole('link', { name: /support this project/i });
  await expect(donateLink).toHaveAttribute('href', /donate\.stripe\.com/);
});
