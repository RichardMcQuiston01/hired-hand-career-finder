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

- **API key delivery:** backend proxy. A Chrome extension's bundle is always
  inspectable, so the O\*NET key must never ship client-side. A small proxy
  holds the key server-side; the extension only ever talks to the proxy.
  **Revisited in Stage 8:** the user later clarified key secrecy was never
  actually the concern — O\*NET keys are free and self-service — only
  staying under O\*NET's own rate limit was. That reopened whether the proxy
  was worth keeping at all; it was, once a real, always-on host (the user's
  own VPS, run as a single persistent Docker container rather than
  serverless) made a genuine _global_ rate limiter and response cache
  possible. See Stage 8 below.
- **Monetization (v1):** Donate link (reuse existing Stripe link/QR) + an
  ExtensionPay-gated premium feature. No ads in v1.
- **Data storage:** none required for v1. The proxy is stateless (rate-limited via
  KV, not a database); ExtensionPay handles its own billing state. If a future
  phase adds saved history/accounts, that's where Prisma + Postgres (UUID PKs,
  snake_case columns, `created_at`/`updated_at`) comes in — deferred until needed.

## Repo layout (npm workspaces monorepo)

```
apps/
  extension/   Vite + React + TS + Tailwind, MV3 Side Panel extension
  proxy/       Next.js API routes, Dockerized (Stage 8), deployed on the user's own VPS — holds ONET_API_KEY, per-client + global rate limits, response caching, CORS-locked to the extension origin
packages/
  onet-mnm-client/  typed fetch client (Zod-validated) for search/careers/interestprofiler, calls the proxy, never the key
  shared/           shared TS types (RIASEC, Career, etc.)
docs/
  DEVELOPMENT_PLAN.md  (this file)
```

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
listing (icon, screenshots, privacy policy — note we store no PII, Interest
Profiler answers are processed statelessly through the proxy) in the
Developer Dashboard; subsequent version bumps publish via the API.

**Stage 8 — Harden and self-host the proxy on the user's own VPS (Docker)**
(off `dev`) Revisited Stage 1's proxy after weighing two alternatives with
the user: dropping it for a build-time key baked into the extension plus
`host_permissions` (rejected — key secrecy was never actually the concern;
staying under O\*NET's rate limit was, and a proxy protects that better than
a client-only mitigation ever could), and hosting it serverless on
Vercel/Supabase (rejected once the user pointed out they already pay for a
VPS — a single persistent container makes a genuine _global_ rate limiter
possible, which independent, ephemeral serverless instances can't offer).
Landed on: keep the proxy, run it as one long-lived Docker container on the
user's own VPS, and layer caching/rate-limiting on both sides of the wire.

- `apps/proxy/src/lib/rateLimit.ts`: added `checkGlobalRateLimit()` — a
  second limiter alongside the existing per-client-IP one, keyed on a single
  fixed key (`__global__`) instead of per-caller. This is only meaningful
  because the proxy is now guaranteed to run as a single process rather than
  independent serverless instances that would each track their own count;
  env-tunable via `GLOBAL_RATE_LIMIT_MAX_REQUESTS` /
  `GLOBAL_RATE_LIMIT_WINDOW_MS`.
- `apps/proxy/src/lib/cache.ts` (new): an in-process response cache keyed by
  upstream path + query string, checked before either rate limiter (a cache
  hit costs nothing against the budget) — a long TTL for near-static
  endpoints (the Interest Profiler's fixed question sets) and a shorter
  default TTL for everything else, matching O\*NET's own documented
  recommendation to cache repeat requests.
- `apps/extension/src/lib/cachingFetch.ts` (new): a client-side,
  `localStorage`-backed cache plus a self-imposed call budget (per the
  user's explicit direction to use `localStorage` for both), wrapping
  `onet-mnm-client`'s `fetchImpl`. This is a second, independent layer in
  front of the proxy's own cache/limiter — it cuts real round-trips (and
  load on the proxy) for repeat lookups within one browser profile, on top
  of whatever the proxy does for the aggregate across all installs.
- `apps/proxy/Dockerfile` (new): multi-stage build (deps/builder/runner) on
  `node:22-alpine`, using Next.js's `output: 'standalone'` for a lean image,
  non-root user. `docker-compose.yml` binds only to `127.0.0.1:3100` — the
  VPS already runs other services, so this deliberately doesn't claim a
  public port; an existing reverse proxy (nginx/Caddy) fronts it for real
  HTTPS. See `docs/VPS_DEPLOY.md` for the one-time VPS setup and the
  day-to-day deploy flow.
- `.github/workflows/deploy-proxy.yml` (new): SSH-based deploy
  (`appleboy/ssh-action`) to the VPS, using `VPS_HOST` / `VPS_USER` /
  `VPS_SSH_KEY` (/ `VPS_SSH_PORT`) GitHub Actions secrets rather than
  passing live credentials through chat or committing them anywhere — the
  same trust model `release.yml` already uses for the Chrome Web Store
  secrets.
- Everything from Stages 1–7 that depended on the proxy (the
  `onet-mnm-client` package's contract, the Stage 6 `e2e-integration`
  suite's real-proxy `webServer`, `manifest.json`'s empty
  `host_permissions`) is unchanged — this stage only adds caching,
  rate-limiting, and a real deployment target; it doesn't touch the
  client/proxy contract itself.

## Immediate next step

Stages 0–8 are done except: the first VPS deploy (one-time Docker/reverse-proxy
setup plus wiring the `deploy-proxy.yml` GitHub Actions secrets — see
`docs/VPS_DEPLOY.md`), and pushing the `vX.Y.Z` tag (needs the Chrome Web
Store OAuth secrets and a first draft store listing — see
`docs/CHROME_WEB_STORE_DEPLOY.md`).
