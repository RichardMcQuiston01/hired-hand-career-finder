# Hired Hand: Career Finder — Development Plan

Multi-agent, multi-stage plan for building the extension. Written after reviewing
the README and the `@richardmcquiston01/onet-library` NPM package/source.

## What the library gives us (and doesn't)

`@richardmcquiston01/onet-library` is a React hook/component library wrapping only
the O\*NET **`/online`** portal (occupation overview + detail sections, keyword
search) via `OnetClient`, authenticating with an `X-API-Key` header. Per its own
README, it does **not** wrap `/mnm`, `/veterans`, `/mpp`, or the Interest Profiler.

This extension's three named features live in the **`/mnm`** portal instead
(confirmed against `resources/onet-web-services-openapi.json` in that repo):

| Feature           | Endpoint(s)                                                                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Career Search     | `GET /mnm/search?keyword=`                                                                                                                                                                                                                   |
| Browse Careers    | `GET /mnm/careers/` (list) + `GET /mnm/careers/{code}/{section}` (skills, knowledge, abilities, personality, education, job_outlook, technology, explore_more)                                                                               |
| Interest Profiler | `GET /mnm/interestprofiler/questions` (60Q) or `questions_30` (short form) → answer string `[1-5]{30}` or `{60}` → `GET /mnm/interestprofiler/results` (RIASEC scores) → `GET /mnm/interestprofiler/careers` (matches, filterable by `zone`) |

All endpoints require `X-API-Key` on every call. We'll write a small typed
`onet-mnm-client` package for these; `@richardmcquiston01/onet-library` can still
be used for `/online` detail data (e.g. richer occupation descriptions) in Browse
Careers if useful.

## Key decisions (confirmed with user)

- **API key delivery:** direct client-side call, no backend proxy. Stages
  1–7 built and shipped a backend proxy on the assumption that the O\*NET
  key needed to stay secret; **revisited in Stage 8** once the user clarified
  the key isn't actually sensitive (O\*NET Web Services keys are free,
  self-service, and not treated as confidential) — the only real concern is
  not exceeding O\*NET's own rate limits, which a proxy doesn't meaningfully
  solve without a durable, globally-shared store (real infrastructure this
  project doesn't have) anyway. The extension now calls O\*NET directly,
  with the key baked in at build time and `host_permissions` covering
  O\*NET's origin (the standard MV3 mechanism for an extension-context fetch
  to bypass a target server's CORS policy). See Stage 8 below for what that
  removed and added.
- **Monetization (v1):** Donate link (reuse existing Stripe link/QR) + an
  ExtensionPay-gated premium feature. No ads in v1.
- **Data storage:** none required for v1. The proxy is stateless (rate-limited via
  KV, not a database); ExtensionPay handles its own billing state. If a future
  phase adds saved history/accounts, that's where Prisma + Postgres (UUID PKs,
  snake_case columns, `created_at`/`updated_at`) comes in — deferred until needed.

## Repo layout (npm workspaces monorepo)

```
apps/
  extension/   Vite + React + TS + Tailwind, MV3 Side Panel extension — calls O*NET directly (Stage 8)
packages/
  onet-mnm-client/  typed fetch client (Zod-validated) for search/careers/interestprofiler
  shared/           shared TS types (RIASEC, Career, etc.)
docs/
  DEVELOPMENT_PLAN.md  (this file)
```

(`apps/proxy` existed from Stage 1 through Stage 7 and was removed in Stage 8 — see below.)

Tooling: TypeScript strict mode, ESLint (Google TS Style Guide), Prettier,
Vitest + React Testing Library + `jest-axe`, Playwright for E2E.

## Branding

Sourced from the Hired Hand brand's design system:
https://claude.ai/artifact/YESibrGgC1otZwcLnTf6Kv (design tokens, voice,
logo assets — read `project/README.md` and `project/tokens.json` there for
the full brand book; only the subset this extension currently uses is wired
into `apps/extension/src/index.css`).

Hired Hand is the brand behind this extension and its sibling, [Job
Application Assistant](https://github.com/RichardMcQuiston01/hired-hand-extension).
Both share **the same fixed cowhand-with-phone lockup** — the guide is
explicit that the mark is not token-driven and must not be recolored per
product, so Career Finder does not get its own tinted variant; the two
extensions are told apart by name and in-product context, not by the icon.
`apps/extension/public/icons/*.png` are the real mark (cropped from the
brand system's uploaded asset), not placeholders — replace them only if the
brand system's logo asset changes.

Color (light/dark pairs), type (Inter/Space Grotesk/JetBrains Mono via
Google Fonts), spacing, and radius tokens come from `tokens.json` in that
system. Voice: plainspoken and direct ("Find three roles that match your
resume," not "Unlock your career potential"); a light Western turn of
phrase is fine in empty states, never in errors or legal copy.

## Git workflow

- `main` — production, tags trigger Chrome Web Store release.
- `staging` — pre-release integration/testing.
- `dev` — integration branch; all feature branches fork from and PR back into it.
- `feature/<name>` — one per agent/workstream below.

Flow: `feature/* → dev` (PR) → once a stage's features are in, `dev → staging`
(PR, manual/E2E test pass) → `staging → main` (PR) → tag `vX.Y.Z` on `main` →
CI publishes to the Chrome Web Store.

`dev` and `staging` branches are created from `main` as part of Stage 0 so this
flow is usable immediately.

## Accessibility baseline (applies to every stage)

WCAG 2.1 AA target: semantic landmarks, labeled form controls, visible focus
states, `aria-live` regions for async results, focus management in the
multi-step Interest Profiler, ≥4.5:1 contrast in the Tailwind theme,
`prefers-reduced-motion` support, full keyboard operability (no mouse-only
interactions), skip link into the side panel content. Enforced via `jest-axe` in
unit tests and a Lighthouse CI accessibility gate in CI — not just a Stage 4
afterthought.

## Stages and agents

Each bullet is a parallelizable unit of work (subagent + feature branch). Stages
are sequential; agents within a stage run concurrently once their stage's
prerequisites are merged to `dev`.

**Stage 0 — Foundation** (`feature/repo-scaffold`, single agent, blocking)
Monorepo scaffold, MV3 manifest with Side Panel registered, Tailwind config,
ESLint/Prettier, Vitest wiring, base CI (lint/typecheck/test), create `dev` and
`staging` branches.

**Stage 1 — Core infrastructure** (from `dev`, parallel)

- Agent A — `feature/api-proxy`: Next.js proxy, key injection, origin allowlist
  (`chrome-extension://<id>`), rate limiting, error normalization.
- Agent B — `feature/extension-shell`: Side Panel layout/nav, accessible shell
  (landmarks, skip link, theming), Options page skeleton.
- Agent C — `feature/onet-client-package`: `onet-mnm-client` + `shared` types,
  Zod validation, unit tests against mocked proxy responses.

**Stage 2 — Features** (from `dev`, parallel)

- Agent D — `feature/career-search`: debounced search, results list, `aria-live`
  result count.
- Agent E — `feature/browse-careers`: paginated/filterable list + tabbed career
  detail view.
- Agent F — `feature/interest-profiler`: question wizard (progress, Likert
  radio-groups), in-progress answers persisted to `chrome.storage.session`,
  RIASEC results view, matched-careers list linking into Browse Careers.

**Stage 3 — Monetization** (from `dev`, parallel)

- Agent G — `feature/donate-block`: Support section in Options/side-panel
  footer using the existing `donate.svg`/Stripe link.
- Agent H — `feature/extensionpay`: ExtensionPay SDK integration, paywall UI,
  restore-purchase flow, gating one concrete premium feature (proposed in that
  PR for sign-off, e.g. exporting Interest Profiler results or an unlimited
  saved-career shortlist).

**Stage 4 — Accessibility & QA hardening** (from `dev`, after Stage 2/3 merge)
`feature/a11y-hardening`: full WCAG 2.1 AA pass — automated (axe/Lighthouse CI
gate tightened to fail build), manual keyboard-only + screen reader (VoiceOver/
NVDA) walkthrough documented in the repo, contrast/theme fixes.

**Stage 5 — CI/CD** ✅ (`feature/release-cicd`, merged to `dev`)
`ci.yml` (lint/typecheck/test/build/a11y gate on PRs to `dev`/`staging`/`main`
— done in Stage 0/4) plus `release.yml`: on `v*.*.*` tag push, re-runs the
full CI gate, fails fast if the tag doesn't match
`apps/extension/public/manifest.json`'s `version`, builds and zips the
extension, then publishes it via direct calls to the Chrome Web Store
Publish API (token exchange, upload, publish) rather than a third-party
action — the two candidate actions checked during this stage either no
longer resolve or require restructuring the four secrets into a single JSON
blob, so calling the (well-documented, stable) REST API directly keeps the
secrets as the four separate values `apps/extension/.env.example` and the
`get-refresh-token` helper scripts already establish: `CHROME_CLIENT_ID`,
`CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `CHROME_EXTENSION_ID`. Also
fixed the path assumptions in the `scripts/*.mjs`/`get-refresh-token.*`
files pushed directly to `dev` (they assumed `scripts/` lived under
`apps/extension/`, not the repo root) by relocating them there, and added
the missing `sharp` dependency for `gen-icons.mjs`. See
`docs/CHROME_WEB_STORE_DEPLOY.md` for the full setup and release process.
Proxy deploys via Vercel's git integration on push to `staging`/`main`,
independent of extension versioning.

**Stage 6 — Staging integration test** ✅ (`feature/staging-integration-e2e`,
merged to `dev`)
`apps/extension/e2e-integration/`: a new Playwright layer, distinct from the
Stage 4 `apps/extension/e2e/` whole-page a11y suite (which mocks
`chrome.*`/network at the `page.route` level inside a plain `vite preview`
tab). This one loads the real built, unpacked extension into a real
Chromium extension context (`--load-extension`, headless via Chromium's
"new" headless mode) — a real `chrome.runtime`, a real background service
worker, so `extpay` and `chrome.runtime.getManifest()` run unmodified
instead of being stubbed — and runs it against the real `apps/proxy` Next.js
server, not an in-process mock of the route handler. Confirms: Search,
Browse (list + detail), and the Interest Profiler complete end-to-end
through a real HTTP round-trip to the real proxy; the extension never calls
`api-v2.onetcenter.org` directly and the API key never appears in any
request the browser makes nor anywhere in the built `dist/` bundle; the
donate link is real; ExtensionPay degrades gracefully to the unpaid paywall
state rather than hanging or crashing when its own remote check fails.

**What's genuinely live vs. mocked:** this sandbox cannot reach
`api-v2.onetcenter.org` (org policy blocks the egress — same restriction
`apps/proxy/README.md` already documented) even though a real `ONET_API`
key is available, so `apps/proxy`'s upstream base URL is pointed at a small
local fixture server (`e2e-integration/fixtures/mock-onet-server.mjs`) via
the new `ONET_BASE_URL` env override instead. Everything up to that last
hop is real: the extension's own network calls, the real proxy process
(key injection, CORS, the allow-list, error normalization), a real
`chrome-extension://` origin. Only the proxy-to-O\*NET leg itself remains
unverified against the live API — someone with unrestricted network access
(or once `apps/proxy` is actually deployed) should run this suite once
against the real upstream to close that last gap.

**Found and fixed a real production bug in the process:** `listCareers()`
and the section-less `getCareerDetail()` in `onet-mnm-client` built
trailing-slash request paths (`/mnm/careers/`, `/mnm/careers/{code}/`); the
proxy's Next.js catch-all route 308-redirects those to the slash-less form,
and that redirect response carries no CORS headers, so every real browser
call to Browse Careers would have silently failed with an opaque CORS error
— invisible to both the unit tests (which call the route handler directly,
bypassing Next's HTTP routing layer) and the Stage 4 suite (which mocks the
network entirely). This is exactly the class of bug Stage 6 exists to catch.
Fixes land back through `dev`.

**Stage 7 — Release** ✅ (`staging → main` merged; tag/publish still pending)
PR `staging → main` merged. Tag `vX.Y.Z` → `release.yml` publishes to the
Chrome Web Store. First-ever submission needs a one-time manual store
listing (icon, screenshots, privacy policy — note we store no PII; Interest
Profiler answers are scored client-side and never sent anywhere except
directly to O\*NET as part of the results/careers lookup, same as any other
query this extension makes) in the Developer Dashboard; subsequent version
bumps publish via the API.

**Stage 8 — Remove the backend proxy, call O\*NET directly**
(`feature/remove-proxy-direct-onet`, off `dev`) User-directed architecture
change after Stage 7: the O\*NET key isn't actually sensitive, so the
backend proxy built in Stage 1 was pure complexity with no real payoff — see
the "Key decisions" note above. Changes:

- Deleted `apps/proxy` entirely.
- `onet-mnm-client`: `createOnetMnmClient` takes an optional `apiKey`, sent
  as `X-API-Key` on every request; `baseUrl` now points straight at
  `https://api-v2.onetcenter.org`. Reverted the Stage 6 no-trailing-slash
  fix on `listCareers`/`getCareerDetail` — that redirect-dropping-CORS bug
  was specific to the proxy's Next.js catch-all route and doesn't exist
  once there's no proxy in the path; O\*NET's own REST scheme wants the
  trailing slash back.
- `apps/extension/public/manifest.json`: added
  `host_permissions: ["https://api-v2.onetcenter.org/*"]` — this is what
  lets an extension-context `fetch` (side panel, options, background;
  **not** a content script) bypass the target's CORS policy under MV3,
  which is what makes calling O\*NET directly possible at all. This is
  documented, long-standing Chrome extension platform behavior, but
  **could not be verified against the live API from this sandbox** — its
  Chromium instances have no working TLS trust for any outbound HTTPS at
  all (a proxy/certificate limitation unrelated to CORS), so no live
  external fetch, permissive-CORS or not, could be tested here. Worth a
  manual smoke test in a real Chrome install before calling this fully
  verified.
- The O\*NET key is baked into the build at compile time via
  `VITE_ONET_API_KEY` (see README.md and `release.yml`) and ships inside
  the extension's inspectable bundle — intentional, not an oversight, per
  the key decision above.
- **Rate-limit mitigation, since there's no server left to do it
  centrally:** `apps/extension/src/lib/cachingFetch.ts` wraps every O\*NET
  call in a `localStorage`-backed response cache (O\*NET's own docs
  recommend caching repeat requests; most of what this client asks for —
  search terms, browsed occupations, the Interest Profiler's fixed
  question sets — repeats heavily and barely changes) and a self-imposed
  rate cap (20 calls/minute per browser profile). Both are necessarily
  scoped to one installation — there's no way, without a server, to see or
  limit what every user's install is doing in aggregate. That's an accepted
  tradeoff, not a gap to close later.
- Stage 6's `e2e-integration` suite no longer runs a real proxy server (there
  is none); it now mocks O\*NET via `page.route`, same mechanism as the
  Stage 4 suite, while still loading the real extension into a real
  Chromium extension context. Added a real end-to-end regression test that
  a repeated identical request is served from the cache rather than hitting
  the network again.

## Immediate next step

Stages 0–8 are done except: pushing the `vX.Y.Z` tag (needs the Chrome Web
Store OAuth secrets and a first draft store listing — see
`docs/CHROME_WEB_STORE_DEPLOY.md`), and the manual host_permissions/CORS
smoke test called out in Stage 8 above.
