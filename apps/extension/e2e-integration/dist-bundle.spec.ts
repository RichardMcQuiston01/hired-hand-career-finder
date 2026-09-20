/**
 * Static check on the actual built artifact (`apps/extension/dist`) rather
 * than a browser: the O*NET API key must never be embedded in the shipped
 * bundle, and the extension's own code must never itself set an
 * `X-API-Key` header (only `apps/proxy` may do that, server-side).
 */
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { E2E_ONET_API_KEY } from './fixtures/constants';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '../dist');

function listFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

test('the built extension bundle never embeds an O*NET API key or sets X-API-Key itself', () => {
  const files = listFiles(DIST_DIR).filter((file) => statSync(file).isFile());
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    const contents = readFileSync(file, 'utf-8');
    expect(contents.includes(E2E_ONET_API_KEY), `${file} must not contain the O*NET API key`).toBe(
      false,
    );
    expect(
      /x-api-key/i.test(contents),
      `${file} must not reference X-API-Key — only apps/proxy injects it, server-side`,
    ).toBe(false);
  }
});
