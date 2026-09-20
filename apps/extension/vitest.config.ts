import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // `e2e/**` holds the separate Playwright + axe-core/Playwright layer
    // (see `e2e/playwright.config.ts`, `npm run test:e2e`) — a different
    // runner with its own `test`/`describe` globals that Vitest must not
    // also try to collect.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
