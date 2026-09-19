import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        sidepanel: resolve(root, 'src/sidepanel/index.html'),
        options: resolve(root, 'src/options/index.html'),
        background: resolve(root, 'src/background/index.ts'),
      },
      output: {
        // The MV3 manifest references `background.js` by that literal,
        // unhashed path — keep it stable while the page bundles stay
        // content-hashed as usual.
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
});
