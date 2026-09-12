/**
 * Auth helpers for E2E tests.
 *
 * The SPA authenticates API calls with a bearer token read from
 * localStorage, so tests seed the token before the app boots via
 * addInitScript (runs before any page script on every navigation).
 */
import { Page } from '@playwright/test';

export async function seedAuthToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('auth_token', value);
  }, token);
}
