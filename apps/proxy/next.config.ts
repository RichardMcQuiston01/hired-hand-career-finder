import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces a minimal `.next/standalone` folder (only the files/deps this
  // app actually needs) — the Dockerfile at the repo root of this app
  // copies that instead of the full node_modules tree, for a much smaller
  // image than a naive `next start` container would need.
  output: 'standalone',
};

export default nextConfig;
