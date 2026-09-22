/**
 * Whole-page WCAG 2.1 A+AA axe scans, in addition to (not instead of) the
 * per-component `jest-axe` unit tests under `src` (`*.test.tsx`). Those catch
 * issues within one rendered component; this catches issues that only show
 * up in the fully assembled page — duplicate ids across components sharing
 * a page, landmark structure, real cross-component tab order — with the
 * onetClient network calls intercepted so every meaningful state (idle,
 * populated, error-free) actually renders instead of only ever showing an
 * empty or error state.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installChromeStub } from './fixtures/chromeStub';
import { installOnetMocks } from './fixtures/mockOnet';
import { blockExternalFonts } from './fixtures/network';
import { completeShortAssessment } from './fixtures/interestProfiler';

const WCAG_2_1_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_2_1_AA_TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe('Side panel — Search tab', () => {
  test.beforeEach(async ({ page }) => {
    await installChromeStub(page);
    await installOnetMocks(page);
    await blockExternalFonts(page);
    await page.goto('/src/sidepanel/index.html');
  });

  test('idle state', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Search', selected: true })).toBeVisible();
    await expect(page.getByText('Search for a career to get started.')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('populated results, including a Bright Outlook result', async ({ page }) => {
    await page.getByPlaceholder('Search careers, e.g. nurse').fill('nurse');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('3 results for "nurse"')).toBeVisible();
    await expect(page.getByTitle('Bright Outlook')).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe('Side panel — Browse tab', () => {
  test.beforeEach(async ({ page }) => {
    await installChromeStub(page);
    await installOnetMocks(page);
    await blockExternalFonts(page);
    await page.goto('/src/sidepanel/index.html');
    await page.getByRole('tab', { name: 'Browse' }).click();
  });

  test('list view', async ({ page }) => {
    await expect(page.getByText('Showing careers 1–5 of 5.')).toBeVisible();
    await expect(page.getByLabel('Bright Outlook career')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('career selected, with a detail section loaded', async ({ page }) => {
    await page.getByRole('button', { name: /Software Developers/ }).click();
    await expect(page.getByRole('heading', { name: 'Software Developers' })).toBeVisible();
    await page.getByRole('button', { name: 'Skills' }).click();
    await expect(page.getByText('Critical Thinking')).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe('Side panel — Interest Profiler tab', () => {
  test.beforeEach(async ({ page }) => {
    await installChromeStub(page);
    await installOnetMocks(page);
    await blockExternalFonts(page);
    await page.goto('/src/sidepanel/index.html');
    await page.getByRole('tab', { name: 'Interest Profiler' }).click();
  });

  test('intro step', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Find careers that fit your interests' }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('mid-question step', async ({ page }) => {
    await page.getByRole('button', { name: 'Short form — 30 questions' }).click();
    await expect(page.getByText(/Question 1 of 30/)).toBeVisible();
    await page.getByRole('radio', { name: /^4\./ }).check();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText(/Question 2 of 30/)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('results view, export actions visible', async ({ page }) => {
    await completeShortAssessment(page);
    await expect(page.getByRole('button', { name: /export as csv/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /print.*pdf/i })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe('Options page', () => {
  test('About + Support sections', async ({ page }) => {
    await installChromeStub(page);
    await blockExternalFonts(page);
    await page.goto('/src/options/index.html');
    await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
