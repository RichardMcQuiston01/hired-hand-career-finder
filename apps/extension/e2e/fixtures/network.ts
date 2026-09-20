import type { Page } from '@playwright/test';

/**
 * Aborts the Google Fonts requests every page makes (each page's index.html
 * preconnects and loads them). This sandbox has no live network access to
 * fonts.googleapis.com/fonts.gstatic.com, and even where they are reachable
 * blocking them keeps the a11y/keyboard scans fast and deterministic —
 * `axe-core` and focus order don't depend on which font actually rendered.
 */
export async function blockExternalFonts(page: Page): Promise<void> {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
}
