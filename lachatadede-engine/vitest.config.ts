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
    // Full-match simulations are CPU-bound and sandboxed execution is
    // wall-clock sensitive: parallel workers starve each other and can make
    // tick deadlines spuriously fire. Run test files sequentially.
    fileParallelism: false,
  },
});
