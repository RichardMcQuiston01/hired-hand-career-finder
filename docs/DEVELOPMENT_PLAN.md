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
  inspectable, so the O\*NET key must never ship client-side. A small serverless
  proxy (Next.js API routes on Vercel) holds the key server-side; the extension
  only ever talks to the proxy.
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
  proxy/       Next.js API routes (Vercel) — holds ONET_API_KEY, rate limits, CORS-locked to the extension origin
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

**Stage 5 — CI/CD** (from `dev`, parallel with Stage 2-4 once Stage 0/1 land)
`feature/ci-cd`: `ci.yml` (lint/typecheck/test/build/a11y gate on PRs to
`dev`/`staging`/`main`); `release.yml` (on `v*.*.*` tag push to `main` — build,
zip, publish via the Chrome Web Store Publish API using a maintained action,
mirroring `onet-library`'s own tag-triggered publish workflow; secrets:
`CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_EXTENSION_ID`).
Proxy deploys via Vercel's git integration on push to `staging`/`main`,
independent of extension versioning.

**Stage 6 — Staging integration test**
PR `dev → staging`. Playwright E2E with the unpacked extension: open side
panel, search, browse a career, complete the Interest Profiler end-to-end,
confirm the API key never appears in network requests or the built bundle,
verify donate + ExtensionPay flows. Fixes land back through `dev`.

**Stage 7 — Release**
PR `staging → main`. Tag `vX.Y.Z` → `release.yml` publishes to the Chrome Web
Store. First-ever submission needs a one-time manual store listing (icon,
screenshots, privacy policy — note we store no PII, Interest Profiler answers
are processed statelessly through the proxy) in the Developer Dashboard;
subsequent version bumps publish via the API.

## Immediate next step

Stage 0 (`feature/repo-scaffold`) is unblocked and has no dependencies — start
there.
