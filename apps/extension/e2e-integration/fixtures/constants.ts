/**
 * Shared between `playwright.config.ts` (which starts the mock O*NET server
 * and the real proxy with these values) and the specs (which assert this
 * key never appears anywhere the browser or the built bundle could reveal
 * it). A single source of truth avoids the two drifting apart silently.
 */
export const E2E_ONET_API_KEY = 'e2e-integration-test-key-must-not-leak-92f1';
export const MOCK_ONET_PORT = 4790;
export const PROXY_PORT = 3000;
