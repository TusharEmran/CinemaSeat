import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Integration tests start real Postgres + Redis containers, so they need
    // room. Unit tests are pure and finish in milliseconds.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/db/seed.ts', 'src/db/migrations/**'],
      thresholds: {
        // The paths that must not regress: hold claiming and callback handling.
        'src/modules/seating/**': { lines: 90, functions: 90 },
        'src/modules/payment/**': { lines: 90, functions: 90 },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
