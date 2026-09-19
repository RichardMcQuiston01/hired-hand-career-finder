import ExtPay from 'extpay';

/**
 * The extension id registered at https://extensionpay.com for this project.
 *
 * There is no real ExtensionPay account for "Hired Hand: Career Finder" yet
 * (same situation the O*NET API key was in before it was provisioned) — this
 * placeholder must be replaced with a real slug registered at
 * https://extensionpay.com before payments will actually work. Every context
 * that talks to ExtensionPay (the background service worker, this module's
 * consumers) reads it from here so there is exactly one place to update.
 */
export const EXTPAY_EXTENSION_ID = 'hired-hand-career-finder';

/**
 * Creates a fresh ExtPay client for the current context. ExtPay clients are
 * lightweight and safe to instantiate per-context (side panel, options page,
 * background) — see the extpay README. Exposed as a factory (rather than a
 * shared singleton) so tests can mock the `extpay` module and get a fresh
 * fake client per test.
 */
export function createExtPayClient() {
  return ExtPay(EXTPAY_EXTENSION_ID);
}
