# Chrome Web Store deployment

Stage 5 of `docs/DEVELOPMENT_PLAN.md`. `.github/workflows/release.yml`
publishes the extension to the Chrome Web Store automatically whenever a
`vX.Y.Z` tag is pushed to `main`. This doc covers the one-time setup that
makes that possible, and the day-to-day release process.

## One-time setup

### 1. Google Cloud OAuth client

The Chrome Web Store Publish API authenticates via OAuth 2.0. You need a
Google Cloud OAuth client of type **Desktop app** (not "Web application" —
the loopback flow the helper scripts use requires it):

1. In the [Google Cloud Console](https://console.cloud.google.com/), create
   or pick a project, then enable the **Chrome Web Store API**.
2. Under **APIs & Services → Credentials**, create an **OAuth client ID**
   of type **Desktop app**. Note the client ID and client secret.
3. Find your extension's ID in the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (create a draft listing first if this is the initial submission — see
   below).

### 2. Mint a refresh token

From `apps/extension/`, run one of:

```sh
cd apps/extension
python3 scripts/get-refresh-token.py
# or, on Windows:
.\scripts\get-refresh-token.ps1
```

The script prompts for `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, and
`CHROME_CLIENT_SECRET` (blank ones only — re-run it any time to change a
value), opens your browser for the OAuth consent screen, and writes all
four values, including the resulting `CHROME_REFRESH_TOKEN`, to
`apps/extension/.env` (gitignored — never commit it).

### 3. GitHub Actions secrets

Copy the four values from `apps/extension/.env` into this repository's
**Settings → Secrets and variables → Actions**:

- `CHROME_EXTENSION_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

### 4. First-ever submission

The Publish API can only update an _existing_ store listing — it can't
create the first one. Before the first tag push, manually create a draft
listing in the Developer Dashboard with the built `apps/extension/dist`
(zipped), icon, screenshots, and a privacy policy (this extension stores no
PII — Interest Profiler answers are scored client-side and O*NET lookups
are proxied statelessly; see `apps/proxy/README.md`). Every release after
that goes through `release.yml`.

## Day-to-day release process

1. On `dev` (or a short-lived branch off it), bump the version:

   ```sh
   npm run bump-version -w apps/extension           # patch: 0.1.0 -> 0.1.1
   npm run bump-version -w apps/extension -- --minor
   npm run bump-version -w apps/extension -- --major
   ```

   This updates `version` (and `version_name`, using the codename list in
   `version_names.json` once `major >= 1`) in
   `apps/extension/public/manifest.json`. Commit the result.

2. Merge through the usual `dev` → `staging` → `main` flow (Stages 6-7).

3. Once the bump has landed on `main`, tag it and push the tag:

   ```sh
   git checkout main && git pull
   git tag v0.1.1
   git push origin v0.1.1
   ```

4. `release.yml` runs the full CI gate (lint, typecheck, test, build, a11y
   e2e), fails fast if the tag doesn't match `manifest.json`'s `version`,
   builds and zips `apps/extension/dist`, uploads it to the Chrome Web
   Store, publishes it, and attaches the zip to a GitHub Release.

## Regenerating icons

`apps/extension/public/icons/icon-{16,32,48,128}.png` are already checked
in and don't need regenerating for a normal release. If the source artwork
changes, drop the new master image at
`apps/extension/src-assets/icon-source.webp` (not checked in yet — supply
your own) and run:

```sh
npm run gen-icons -w apps/extension
```
