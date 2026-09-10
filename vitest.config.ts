import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__fixtures__/**', 'src/**/index.ts'],
      reporter: ['text', 'lcov', 'json-summary'],
      // A floor, not a target: the §4.2 properties are what prove correctness.
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
    },
  },
});
