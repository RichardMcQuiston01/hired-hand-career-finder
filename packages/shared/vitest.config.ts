import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // `tsc -b` (run from apps/extension's project-reference build) emits
    // this package's compiled output, tests included, into ./dist. Exclude
    // it so vitest doesn't double-run the same tests from source and dist.
    exclude: [...configDefaults.exclude, 'dist/**'],
  },
});
