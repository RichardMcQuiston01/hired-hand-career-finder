# Hired Hand: Career Finder

## Overview

TypeScript based Chrome Extension incorporating functions O*NET API via the @richardmcquiston01/onet-library NPM library. Users can determine their optimum career using the Interest Profiler as well as find information on certificates, licenses, and more.

See [`docs/DEVELOPMENT_PLAN.md`](./docs/DEVELOPMENT_PLAN.md) for the full
architecture and staged build-out plan.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22.22.2+ (see `.nvmrc`)

### Installation

```bash
npm install
```

This is an npm workspaces monorepo: `apps/extension` (the Chrome extension)
and `packages/*` (shared TypeScript packages). The extension calls O*NET's
Web Services API directly — there is no backend proxy; see
[`docs/DEVELOPMENT_PLAN.md`](./docs/DEVELOPMENT_PLAN.md)'s "Key decisions"
section for why.

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

For Search/Browse/Interest Profiler to actually return data, set
`VITE_ONET_API_KEY` (a free key from
[O\*NET Web Services](https://services.onetcenter.org/)) before building:

```bash
VITE_ONET_API_KEY=your-onet-api-key npm run build -w apps/extension
```

### Examples

## Buy Me a Coffee

If this app, code, or repository has helped you or someone you know, please consider donating. I appreciate any help to offset the costs of development and/or AI Credits.

[**Donate via Stripe**](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800), or scan:

[![Donate via Stripe](./donate.svg)](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800)

## License

Apache 2

## Copyright

(c)2026 Richard McQuiston. All rights reserved.
