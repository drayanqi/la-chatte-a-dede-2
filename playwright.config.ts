import { defineConfig, devices } from '@playwright/test';

/**
 * Lachatadede - Playwright E2E Test Configuration
 *
 * Run E2E tests: npm run test:e2e
 * Run with UI: npm run test:e2e:ui
 * Debug mode: npm run test:e2e:debug
 *
 * @see https://playwright.dev/docs/test-configuration
 */

// The E2E API runs on its own port (8001); tests/support/fixtures reads
// API_URL from the environment. Default it here so test workers always
// agree with the webServer below, even with nothing exported in the shell.
process.env.API_URL ||= 'http://127.0.0.1:8001/api/';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // workers:1 everywhere (CI already did; local aligned in story 4.1): the
  // single PHP worker starves under full-parallel (deferred-work.md#73) and
  // the matchmaking queue is global shared state — two concurrently running
  // queue tests would pair each other's users (AC #3 timeout race).
  workers: 1,

  // Timeouts optimized for game simulation app
  timeout: 60 * 1000, // Test timeout: 60s (match simulation can take up to 2s)
  expect: {
    timeout: 15 * 1000, // Assertion timeout: 15s
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3002',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000, // Action timeout: 15s
    navigationTimeout: 30 * 1000, // Navigation timeout: 30s
  },

  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],

  // Output directory for test artifacts
  outputDir: 'test-results/artifacts',

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Dev servers: the Laravel API backend, the Vite frontend and the Node
  // game engine. The frontend proxies /api to the backend and the backend
  // POSTs simulations to the engine, so all three must be up before tests
  // run (story 3.5 practice matches).
  //
  // E2E is fully hermetic: its own ports (API 8001, frontend 3002 — the dev
  // stack runs on 8000/3000) and its own throwaway sqlite (database/.gitignore
  // covers *.sqlite*). reuseExistingServer is false everywhere so a running
  // developer server can never be adopted — tests would otherwise write
  // users/matches into the main database.sqlite.
  webServer: [
    {
      command:
        '[ -f database/e2e.sqlite ] || touch database/e2e.sqlite && php artisan migrate:fresh --force && php artisan serve --host=127.0.0.1 --port=8001',
      url: 'http://127.0.0.1:8001/up',
      cwd: 'lachatadede-api',
      reuseExistingServer: false,
      timeout: 120 * 1000, // 2 min for backend startup
      env: {
        // Test-only key (safe to commit): CI has no lachatadede-api/.env and
        // the stateful Sanctum flow sets session cookies → encrypter needed.
        APP_KEY: 'base64:5w5CoLJ3wgf0+mTDnAoac9DW10i8ScBiIDtfrLea0f8=',
        // E2E creates many users per minute; keep the auth rate limiter open
        AUTH_THROTTLE_MAX: '1000',
        DB_DATABASE: 'database/e2e.sqlite',
        GAME_ENGINE_URL: 'http://127.0.0.1:3001',
        APP_URL: 'http://127.0.0.1:8001',
        // The SPA (proxied through the Vite dev server) must count as a
        // first-party client for Sanctum's stateful cookie flow
        SANCTUM_STATEFUL_DOMAINS: 'localhost:3002,127.0.0.1:3002',
      },
    },
    {
      command: 'npm run dev -- --port 3002 --strictPort',
      url: 'http://localhost:3002',
      reuseExistingServer: false,
      timeout: 120 * 1000, // 2 min for dev server startup
      // API_URL (above) is inherited: Vite proxies /api to the E2E API
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:3001/health',
      cwd: 'lachatadede-engine',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 min for engine startup
    },
  ],
});
