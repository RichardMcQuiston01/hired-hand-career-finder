/**
 * Stage 6 staging integration suite — see `playwright.config.ts`'s top
 * comment for what makes this different from the Stage 4 `apps/extension/e2e/`
 * layer. Covers the three named features end-to-end through the real
 * extension + real proxy, and the two "never leaks" guarantees the
 * development plan calls out by name: the O*NET key never reaches the
 * browser, and the extension never talks to O*NET directly.
 */
import { test, expect } from './fixtures/extension';
import { E2E_ONET_API_KEY, PROXY_PORT } from './fixtures/constants';
import { completeShortAssessment } from '../e2e/fixtures/interestProfiler';

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
  await page.goto(sidePanelUrl(extensionId));
  await expect(page).toHaveTitle('Hired Hand: Career Finder');
  await expect(page.getByRole('tab', { name: 'Search', selected: true })).toBeVisible();
});

test.describe('network guarantees', () => {
  test('Career Search never calls O*NET directly and never exposes the API key', async ({
    page,
    extensionId,
    context,
  }) => {
    const requestUrls: string[] = [];
    context.on('request', (request) => requestUrls.push(request.url()));

    await page.goto(sidePanelUrl(extensionId));
    await page.getByPlaceholder('Search careers, e.g. nurse').fill('nurse');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('3 results for "nurse"')).toBeVisible();
    await expect(page.getByTitle('Bright Outlook')).toBeVisible();

    const wentToRealOnet = requestUrls.some((url) => url.includes('onetcenter.org'));
    expect(wentToRealOnet, 'extension must only ever call the local proxy').toBe(false);

    const leakedKey = requestUrls.some((url) => url.includes(E2E_ONET_API_KEY));
    expect(leakedKey, 'the O*NET API key must never appear in a request the browser makes').toBe(
      false,
    );

    const wentThroughProxy = requestUrls.some((url) =>
      url.startsWith(`http://localhost:${PROXY_PORT}/api/onet/mnm/search`),
    );
    expect(wentThroughProxy, 'the search request should have gone through the real proxy').toBe(
      true,
    );
  });
});

test('repeat identical Career Search requests are served from the localStorage cache', async ({
  page,
  extensionId,
}) => {
  // `apps/extension/src/lib/cachingFetch.ts` wraps every proxy call in a
  // localStorage-backed cache (see its own comment for the TTLs). This is
  // the client-side layer sitting on top of the proxy's own server-side
  // cache (`apps/proxy/src/lib/cache.ts`) — both exist because this proxy
  // runs as a single VPS-hosted Docker container, not ephemeral serverless,
  // so caching at either layer meaningfully cuts real O*NET traffic.
  await page.goto(sidePanelUrl(extensionId));
  await page.getByPlaceholder('Search careers, e.g. nurse').fill('nurse');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('3 results for "nurse"')).toBeVisible();

  // Reload the same chrome-extension:// origin — localStorage persists
  // across it in this persistent context, so a fresh page load doesn't
  // clear the cache the way a fresh browser profile would.
  await page.reload();
  const searchRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes(`:${PROXY_PORT}/api/onet/mnm/search`)) {
      searchRequests.push(request.url());
    }
  });

  await page.getByPlaceholder('Search careers, e.g. nurse').fill('nurse');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('3 results for "nurse"')).toBeVisible();

  expect(
    searchRequests,
    'an identical repeat search should be served from the localStorage cache, not a second proxy round-trip',
  ).toHaveLength(0);
});

test('Browse Careers: real proxy round-trip for the list and a detail section', async ({
  page,
  extensionId,
}) => {
  await page.goto(sidePanelUrl(extensionId));
  await page.getByRole('tab', { name: 'Browse' }).click();
  await expect(page.getByText('Showing careers 1–5 of 5.')).toBeVisible();
  await expect(page.getByLabel('Bright Outlook career')).toBeVisible();

  await page.getByRole('button', { name: /Software Developers/ }).click();
  await expect(page.getByRole('heading', { name: 'Software Developers' })).toBeVisible();

  await page.getByRole('button', { name: 'Skills' }).click();
  await expect(page.getByText('Critical Thinking')).toBeVisible();
});

test('Interest Profiler: complete the short form end-to-end through the real proxy', async ({
  page,
  extensionId,
}) => {
  await page.goto(sidePanelUrl(extensionId));
  await page.getByRole('tab', { name: 'Interest Profiler' }).click();

  await completeShortAssessment(page);

  // RIASEC scores and matched careers came back from the (fixture-backed)
  // real proxy round-trip, not a page.route stub.
  await expect(page.getByText('Registered Nurses')).toBeVisible();

  // Export is free, no paywall or third-party payment client involved.
  await expect(page.getByRole('button', { name: /export as csv/i })).toBeVisible();
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
