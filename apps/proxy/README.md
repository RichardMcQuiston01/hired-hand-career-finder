# apps/proxy

Placeholder for the O\*NET API key proxy (Stage 1, `feature/api-proxy` — see
[`docs/DEVELOPMENT_PLAN.md`](../../docs/DEVELOPMENT_PLAN.md)).

Will be a Next.js app deployed to Vercel that holds `ONET_API_KEY` server-side
and proxies `/mnm` requests for the extension, so the key never ships in the
extension bundle. Not yet scaffolded — this directory is a placeholder so the
monorepo's intended layout (`apps/extension`, `apps/proxy`) is visible from
Stage 0.
