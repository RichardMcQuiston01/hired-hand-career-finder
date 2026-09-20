import type { Page } from '@playwright/test';

/**
 * Intercepts every `extensionpay.com` call so `ExportResults`'s paywall
 * renders in both paid and unpaid states without a real network call.
 *
 * In practice the unpaid state never calls out at all (`ExtPay`'s
 * `fetch_user()` returns `{ paid: false, ... }` locally when no API key is
 * stored — see `chromeStub.ts`), but this is registered for both states as
 * a defensive backstop against that changing.
 */
export async function installExtPayMocks(page: Page, options: { paid: boolean }): Promise<void> {
  await page.route('https://extensionpay.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/v2/user')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paid: options.paid,
          paidAt: options.paid ? '2024-06-01T00:00:00.000Z' : null,
          trialStartedAt: null,
          email: options.paid ? 'e2e-test@example.com' : null,
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}
