/**
 * A real keyboard-only walkthrough — Playwright's keyboard API driving the
 * actual browser's tab order and native form-control semantics, no mouse.
 * This is a regression test, not documentation: it fails if the skip link,
 * `Tabs.tsx`'s roving-tabindex arrow-key handling, or a panel's controls
 * stop being reachable/operable by keyboard alone.
 */
import { test, expect } from '@playwright/test';
import { installChromeStub } from './fixtures/chromeStub';
import { installOnetMocks } from './fixtures/mockOnet';
import { blockExternalFonts } from './fixtures/network';

test.beforeEach(async ({ page }) => {
  await installChromeStub(page);
  await installOnetMocks(page);
  await blockExternalFonts(page);
  await page.goto('/src/sidepanel/index.html');
});

test('skip link, tablist arrow-navigation, and the Search input are keyboard-operable', async ({
  page,
}) => {
  // 1. The skip link is the first tab stop and is revealed on focus.
  await page.keyboard.press('Tab');
  const skipLink = page.locator('.skip-link');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveText('Skip to main content');

  // 2. Activating it moves focus straight to the main landmark.
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  // 3. The next Tab lands in the tablist, on the already-selected Search tab.
  await page.keyboard.press('Tab');
  const searchTab = page.getByRole('tab', { name: 'Search' });
  await expect(searchTab).toBeFocused();
  await expect(searchTab).toHaveAttribute('aria-selected', 'true');

  // 4. Arrow keys rove across tabs, moving both focus and selection
  //    (WAI-ARIA APG automatic-activation tabs pattern).
  await page.keyboard.press('ArrowRight');
  const browseTab = page.getByRole('tab', { name: 'Browse' });
  await expect(browseTab).toBeFocused();
  await expect(browseTab).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('ArrowRight');
  const profilerTab = page.getByRole('tab', { name: 'Interest Profiler' });
  await expect(profilerTab).toBeFocused();
  await expect(profilerTab).toHaveAttribute('aria-selected', 'true');

  // Wraps around at the end.
  await page.keyboard.press('ArrowRight');
  await expect(searchTab).toBeFocused();
  await expect(searchTab).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('ArrowLeft');
  await expect(profilerTab).toBeFocused();

  await page.keyboard.press('Home');
  await expect(searchTab).toBeFocused();

  // 5. Tab into the Search panel and operate its input/button by keyboard
  //    alone. The tabpanel container itself is a tab stop first (Tabs.tsx
  //    gives every panel `tabIndex={0}` per the WAI-ARIA APG tabs pattern,
  //    so panels are still reachable even when — unlike here — they have no
  //    focusable content of their own).
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tabpanel', { name: 'Search' })).toBeFocused();

  await page.keyboard.press('Tab');
  const searchInput = page.getByPlaceholder('Search careers, e.g. nurse');
  await expect(searchInput).toBeFocused();
  await page.keyboard.type('nurse');
  await page.keyboard.press('Enter');
  await expect(page.getByText('3 results for "nurse"')).toBeVisible();
});

test('Browse list items are keyboard-operable and focus returns to the list on Back', async ({
  page,
}) => {
  await page.getByRole('tab', { name: 'Browse' }).click();
  await expect(page.getByRole('heading', { name: 'Browse careers' })).toBeVisible();

  const firstItem = page.getByRole('button', { name: /Software Developers/ });
  await firstItem.focus();
  await expect(firstItem).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Software Developers' })).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Skills' })).toBeFocused();

  // Back returns keyboard focus to the list item that was activated, rather
  // than dropping it (see `BrowseCareersPanel`'s `restoreFocusCode`).
  await page.getByRole('button', { name: 'Back to results' }).click();
  await expect(firstItem).toBeFocused();
});

test('Interest Profiler Likert options are individually keyboard-operable', async ({ page }) => {
  await page.getByRole('tab', { name: 'Interest Profiler' }).click();
  await page.getByRole('button', { name: 'Short form — 30 questions' }).click();
  await expect(page.getByText(/Question 1 of 30/)).toBeVisible();

  const firstOption = page.getByRole('radio', { name: /^1\./ });
  await firstOption.focus();
  await expect(firstOption).toBeFocused();
  await page.keyboard.press('Space');
  await expect(firstOption).toBeChecked();

  // Native radio-group arrow-key behavior: moves focus AND selection.
  await page.keyboard.press('ArrowDown');
  const secondOption = page.getByRole('radio', { name: /^2\./ });
  await expect(secondOption).toBeFocused();
  await expect(secondOption).toBeChecked();
  await expect(firstOption).not.toBeChecked();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Back' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Next' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByText(/Question 2 of 30/)).toBeVisible();
});
