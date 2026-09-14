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
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Timeouts optimized for game simulation app
  timeout: 60 * 1000, // Test timeout: 60s (match simulation can take up to 2s)
  expect: {
    timeout: 15 * 1000, // Assertion timeout: 15s
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
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
  webServer: [
    {
      command: 'php artisan migrate:fresh --force && php artisan serve --host=127.0.0.1 --port=8000',
      url: 'http://127.0.0.1:8000/up',
      cwd: 'lachatadede-api',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 min for backend startup
      env: {
        // E2E creates many users per minute; keep the auth rate limiter open
        AUTH_THROTTLE_MAX: '1000',
      },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 min for dev server startup
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
