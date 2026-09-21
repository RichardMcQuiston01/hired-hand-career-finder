# syntax=docker/dockerfile:1
#
# apps/proxy is a Next.js app inside an npm-workspaces monorepo. `npm ci`
# needs every workspace's package.json present to validate against the
# root package-lock.json, so the deps stage copies all of them (source
# code included only in the builder stage, after deps are cached) — see
# docs/VPS_DEPLOY.md for the full deploy process this image is built for.

FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/extension/package.json apps/extension/package.json
COPY apps/proxy/package.json apps/proxy/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/onet-mnm-client/package.json packages/onet-mnm-client/package.json
RUN npm ci

FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN npm run build -w apps/proxy

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `output: 'standalone'` (next.config.ts) traces only the files this app
# actually needs into .next/standalone, preserving the monorepo path
# (apps/proxy/...) — static assets and public/ are deliberately excluded
# from that trace and copied in separately.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/proxy/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/proxy/.next/static ./apps/proxy/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/proxy/public ./apps/proxy/public

USER nextjs
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/proxy/server.js"]
