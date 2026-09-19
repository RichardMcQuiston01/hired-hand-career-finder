#!/usr/bin/env node
/**
 * bump-version.mjs
 *
 * Usage:
 *   node scripts/bump-version.mjs           # bump patch  (1.0.0 → 1.0.1)
 *   node scripts/bump-version.mjs --minor   # bump minor  (1.0.3 → 1.1.0)
 *   node scripts/bump-version.mjs --major   # bump major  (1.2.3 → 2.0.0, new codename)
 *
 * Updates version and version_name in public/manifest.json.
 * version_name format: "{major}.{minor} {codename}"  (codename from version_names.json)
 * For major 0 (pre-release) no codename is appended.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, '../public/manifest.json');
const versionNamesPath = resolve(__dirname, '../../version_names.json');

const arg = process.argv[2];
const bumpMajor = arg === '--major';
const bumpMinor = arg === '--minor';

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const { version_names } = JSON.parse(readFileSync(versionNamesPath, 'utf-8'));

const parts = manifest.version.split('.').map(Number);
let [major, minor, patch] = parts.length === 3 ? parts : [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];

if (bumpMajor) {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bumpMinor) {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const newVersion = `${major}.${minor}.${patch}`;
const codename = major >= 1 ? version_names[major - 1] : undefined;
const newVersionName = codename ? `${major}.${minor} ${codename}` : `${major}.${minor}`;

manifest.version = newVersion;
manifest.version_name = newVersionName;

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Bumped to ${newVersion} (${newVersionName})`);
