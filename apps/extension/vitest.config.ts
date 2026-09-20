import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // `e2e/**` and `e2e-integration/**` hold separate Playwright layers
    // (see their own `playwright.config.ts`, `npm run test:e2e` /
    // `test:e2e-integration`) — a different runner with its own
    // `test`/`describe` globals that Vitest must not also try to collect.
    exclude: [...configDefaults.exclude, 'e2e/**', 'e2e-integration/**'],
  },
});
