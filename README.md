# Hired Hand: Career Finder

## Overview

TypeScript based Chrome Extension incorporating functions O*NET API via the @richardmcquiston01/onet-library NPM library. Users can determine their optimum career using the Interest Profiler as well as find information on certificates, licenses, and more.

See [`docs/DEVELOPMENT_PLAN.md`](./docs/DEVELOPMENT_PLAN.md) for the full
architecture and staged build-out plan.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ (see `.nvmrc`)

### Installation

```bash
npm install
```

This is an npm workspaces monorepo: `apps/extension` (the Chrome extension),
`apps/proxy` (the O\*NET API key proxy, added in Stage 1), and
`packages/*` (shared TypeScript packages).

### Usage

```bash
npm run dev     # Vite dev server for the extension
npm run build   # Production build -> apps/extension/dist
npm run lint    # ESLint across the monorepo
npm run test    # Vitest across the monorepo
```

To load the extension in Chrome: `npm run build`, then open
`chrome://extensions`, enable Developer mode, and "Load unpacked" pointing at
`apps/extension/dist`.

### Examples

## Buy Me a Coffee

If this app, code, or repository has helped you or someone you know, please consider donating. I appreciate any help to offset the costs of development and/or AI Credits.

[**Donate via Stripe**](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800), or scan:

[![Donate via Stripe](./donate.svg)](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800)

## License

Apache 2

## Copyright

(c)2026 Richard McQuiston. All rights reserved.
