import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the docs render pipeline (Epic 8.2). Deliberately
 * separate from playwright.config.ts: its testDir points at
 * scripts/action-docs and its webServer is a bare Vite dev server — the
 * normal e2e suite (tests/e2e, full stack) never picks these up.
 *
 * Run: npx playwright test --config=playwright.docs.config.ts
 */
export default defineConfig({
  testDir: './scripts/action-docs',
  testMatch: 'render.spec.ts',
  workers: 1,
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3010',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx vite --port 3010 --strictPort',
    url: 'http://localhost:3010',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
