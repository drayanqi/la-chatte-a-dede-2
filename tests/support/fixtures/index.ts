/**
 * Lachatadede - Test Fixtures
 *
 * This file extends Playwright's base test with custom fixtures for:
 * - User authentication
 * - API request helpers
 * - Data factories with auto-cleanup
 *
 * @see https://playwright.dev/docs/test-fixtures
 */
import { test as base, expect, APIRequestContext } from '@playwright/test';
import { UserFactory } from './factories/user-factory';
import { ScriptFactory } from './factories/script-factory';
import { MatchFactory } from './factories/match-factory';

// Type definitions for custom fixtures
type TestFixtures = {
  userFactory: UserFactory;
  scriptFactory: ScriptFactory;
  matchFactory: MatchFactory;
  apiContext: APIRequestContext;
};

// Extend base test with custom fixtures
export const test = base.extend<TestFixtures>({
  // API context for direct API calls
  apiContext: async ({ playwright }, use) => {
    const apiContext = await playwright.request.newContext({
      baseURL: process.env.API_URL || 'http://localhost:8000/api/',
      extraHTTPHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    await use(apiContext);
    await apiContext.dispose();
  },

  // User factory with auto-cleanup
  userFactory: async ({ apiContext }, use) => {
    const factory = new UserFactory(apiContext);
    await use(factory);
    await factory.cleanup(); // Auto-cleanup after test
  },

  // Script factory with auto-cleanup
  scriptFactory: async ({ apiContext }, use) => {
    const factory = new ScriptFactory(apiContext);
    await use(factory);
    await factory.cleanup();
  },

  // Match factory with auto-cleanup
  matchFactory: async ({ apiContext }, use) => {
    const factory = new MatchFactory(apiContext);
    await use(factory);
    await factory.cleanup();
  },
});

// Re-export expect for convenience
export { expect };
