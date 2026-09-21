# apps/proxy

The O\*NET API key proxy for the Hired Hand: Career Finder Chrome extension
(Stage 1, `feature/api-proxy` — see
[`docs/DEVELOPMENT_PLAN.md`](../../docs/DEVELOPMENT_PLAN.md)).

A Chrome extension's bundle is always inspectable, even packed and minified,
so an O\*NET API key can never ship inside it. This is a small Next.js (App
Router) app that holds the real key server-side and proxies a fixed
allow-list of O\*NET Web Services `/mnm` endpoints for the extension. The
extension only ever talks to this proxy — never to `api-v2.onetcenter.org`
directly.

## Environment variables

| Variable                         | Required      | Description                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ONET_API`                       | Yes           | The real O\*NET Web Services API key, sent upstream as the `X-API-Key` header. Never exposed to callers, never read from a request — this proxy is the only place it lives.                                                                                                                                                                |
| `ALLOWED_EXTENSION_ORIGINS`      | In production | Comma-separated list of exact `chrome-extension://<id>` origins allowed to call this API in production (`NODE_ENV === 'production'`). Outside production, any `chrome-extension://` origin is allowed (there's no fixed extension ID yet during development), and a warning is logged so this is never mistaken for the production policy. |
| `RATE_LIMIT_MAX_REQUESTS`        | No            | Requests allowed per client per window. Defaults to `60`.                                                                                                                                                                                                                                                                                  |
| `RATE_LIMIT_WINDOW_MS`           | No            | Window size in milliseconds. Defaults to `60000` (1 minute).                                                                                                                                                                                                                                                                               |
| `GLOBAL_RATE_LIMIT_MAX_REQUESTS` | No            | Requests allowed across **all** clients per window (see "Rate limiting" below). Defaults to `300`.                                                                                                                                                                                                                                         |
| `GLOBAL_RATE_LIMIT_WINDOW_MS`    | No            | Global window size in milliseconds. Defaults to `60000` (1 minute).                                                                                                                                                                                                                                                                        |
| `ONET_BASE_URL`                  | No            | Overrides the O\*NET API's base URL (default `https://api-v2.onetcenter.org`). Only meant for the Stage 6 integration suite (`apps/extension/e2e-integration/`) to point this proxy at a local fixture server instead — never set this in production.                                                                                      |

Copy `.env.local.example`-style values into `apps/proxy/.env.local` for local
development (that file is gitignored via the repo's root `.gitignore`):

```
ONET_API=your-real-onet-api-key
ALLOWED_EXTENSION_ORIGINS=chrome-extension://your-dev-extension-id
```

## Running locally

From the repo root:

```
npm install
npm run dev -w apps/proxy
```

The app serves on `http://localhost:3000` by default. The only route that
matters is the catch-all API route below; the root page is just a static
placeholder describing the service (this app has no UI).

## API

### `GET /api/onet/[...path]`

Reconstructs the upstream O\*NET path from the dynamic route segments plus
the forwarded query string, checks it against a fixed allow-list, injects
`X-API-Key` from `ONET_API`, and forwards the upstream JSON response and
status code. A request for anything outside the allow-list is rejected with
`404` before any upstream call is made — this proxy is intentionally **not**
an open relay to arbitrary O\*NET paths.

Allow-listed upstream endpoints (segments after `/api/onet/` mirror the
upstream path, i.e. request `/api/onet/mnm/search` to reach
`https://api-v2.onetcenter.org/mnm/search`):

| Extension calls...                                                   | Proxy forwards to...                                                                                                                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/onet/mnm/search?keyword=&start=&end=`                      | `GET /mnm/search?keyword=&start=&end=`                                                                                                                                             |
| `GET /api/onet/mnm/careers?start=&end=`                              | `GET /mnm/careers/?start=&end=`                                                                                                                                                    |
| `GET /api/onet/mnm/careers/{code}`                                   | `GET /mnm/careers/{code}/`                                                                                                                                                         |
| `GET /api/onet/mnm/careers/{code}/{section}`                         | `GET /mnm/careers/{code}/{section}`, `section` ∈ `skills`, `knowledge`, `abilities`, `personality`, `education`, `job_outlook`, `technology`, `explore_more`, `check_out_my_state` |
| `GET /api/onet/mnm/interestprofiler`                                 | `GET /mnm/interestprofiler/`                                                                                                                                                       |
| `GET /api/onet/mnm/interestprofiler/questions?start=&end=`           | `GET /mnm/interestprofiler/questions?start=&end=`                                                                                                                                  |
| `GET /api/onet/mnm/interestprofiler/questions_30?start=&end=`        | `GET /mnm/interestprofiler/questions_30?start=&end=`                                                                                                                               |
| `GET /api/onet/mnm/interestprofiler/job_zones`                       | `GET /mnm/interestprofiler/job_zones`                                                                                                                                              |
| `GET /api/onet/mnm/interestprofiler/results?answers=`                | `GET /mnm/interestprofiler/results?answers=`                                                                                                                                       |
| `GET /api/onet/mnm/interestprofiler/careers?answers=&realistic=&...` | `GET /mnm/interestprofiler/careers?answers=&realistic=&...`                                                                                                                        |

Any other path (any other upstream section, any other `/mnm` or non-`/mnm`
prefix) returns `404`.

**Errors** are normalized to:

```json
{ "error": { "status": 404, "message": "This endpoint is not exposed by this proxy." } }
```

The `status` mirrors the HTTP status code (including the upstream's own
status on a passthrough failure). If the upstream API itself cannot be
reached (network failure), the proxy returns `502`.

**CORS**: only `chrome-extension://` origins ever receive a CORS-enabled
response. `Access-Control-Allow-Origin` always echoes back the exact,
validated request origin — never `*`. `OPTIONS` preflight requests are
handled explicitly; a disallowed origin gets a bare `403` with no CORS
headers at all (so the browser blocks it regardless).

**Rate limiting**: two in-memory, best-effort limiters (`src/lib/rateLimit.ts`),
behind a small `RateLimiter` interface so either can be swapped for a
durable store (e.g. Redis) later without touching the route handler:

- a per-client limiter keyed by the caller's `x-forwarded-for` IP, and
- a global limiter (`checkGlobalRateLimit()`) keyed on a single fixed key,
  capping total requests across every caller combined.

Both are in-memory and per-process, which is why this app is deployed
(see "Deployment" below) as a single long-lived Docker container rather
than serverless: on serverless, each independent instance would track its
own count, so the global limiter wouldn't actually be global. Run as one
process, both limiters are accurate. On limit exceeded (either one), the
route returns `429` with a `Retry-After` header (seconds).

**Response caching** (`src/lib/cache.ts`): successful responses are cached
in-process, keyed by upstream path + query string, and served without
touching either rate limiter on a hit — a long TTL for near-static
endpoints (the Interest Profiler's fixed question sets) and a shorter
default TTL for everything else, per O\*NET's own documented recommendation
to cache repeat requests. This is a second cache layer beneath the
extension's own client-side one (`apps/extension/src/lib/cachingFetch.ts`),
which protects a single browser profile; this one protects the shared
upstream key across every install.

## Tests

```
npm run test -w apps/proxy
```

Vitest unit tests import the route's exported `GET`/`OPTIONS` handlers
directly and call them with constructed `NextRequest` objects, mocking
`global.fetch` so nothing touches the network. Covered: a valid proxied
request (including that the upstream call carries the injected API key and
never a caller-supplied one), upstream error passthrough, an unreachable
upstream (`502`), a rejected disallowed path (no upstream call made), CORS
origin rejection (dev-mode allow-any vs. production allow-list), the
per-client and global rate limiters each denying a request once their
threshold is exceeded, and that a cached response is served on a repeat
request without a second upstream call or counting against either limiter.

## Deployment

This app runs as a single Docker container on the user's own VPS (see
`Dockerfile` and `docker-compose.yml` in this directory, and
[`docs/VPS_DEPLOY.md`](../../docs/VPS_DEPLOY.md) for the one-time VPS setup
and day-to-day deploy flow). `.github/workflows/deploy-proxy.yml` deploys
this app over SSH on push to `main`. `docker-compose.yml` deliberately binds
only to `127.0.0.1:3100` — the VPS runs other services — so an existing
reverse proxy (nginx/Caddy) is expected to front it with a real HTTPS
domain.

**Live verification against the real O\*NET API has still not been done.**
The sandbox this proxy was built in (and the one Stage 6's
`apps/extension/e2e-integration/` suite runs in) blocks network egress to
`api-v2.onetcenter.org` by org policy, so the upstream calls in this app
have only ever been exercised against a mocked `fetch` (unit tests) or a
local fixture server standing in for O\*NET
(`apps/extension/e2e-integration/fixtures/mock-onet-server.mjs`, wired up
via the `ONET_BASE_URL` env override below — real end-to-end otherwise: a
real browser extension, a real HTTP request to this real server, real key
injection and CORS). Only the very last hop, this proxy's own `fetch` to
the real O\*NET API, remains unverified. This needs to happen once the app
is deployed (a Vercel preview) or run from a machine with unrestricted
network access, using a real `ONET_API` key and leaving `ONET_BASE_URL`
unset.
