import { defineConfig } from 'vitest/config';

/**
 * Lachatadede Engine - Vitest Test Configuration
 *
 * Pure Node environment (NOT jsdom): the engine is a headless simulation service.
 *
 * Run tests: npm test
 * Watch mode: npm run test:watch
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 10000,
  },
});
