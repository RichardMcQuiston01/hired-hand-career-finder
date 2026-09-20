// jest-axe ships a Jest matcher (`toHaveNoViolations`) but no Vitest typings.
// This augments Vitest's Assertion interface so `expect(results).toHaveNoViolations()`
// type-checks after `expect.extend(toHaveNoViolations)` in a test file.
import 'vitest';

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T extends { violations: unknown[] } ? void : never;
  }
}
