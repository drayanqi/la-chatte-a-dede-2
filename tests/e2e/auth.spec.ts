/**
 * Authentication E2E Tests
 *
 * Tests the complete authentication flow against the real Laravel API:
 * - User registration (with server-side provisioning checks)
 * - User login
 * - User logout (server-side session termination)
 * - Protected route access
 * - Session persistence across page reloads
 *
 * @see Stories 1.1, 1.2, 1.3 - Epic 1: User Authentication & Onboarding
 */
import { test, expect } from '../support/fixtures';
import { seedAuthToken } from '../support/helpers/auth';

test.describe('Authentication', () => {
  test.describe('Registration', () => {
    test('should allow new user registration @P0', async ({ page }) => {
      // Unique credentials per run
      const email = `e2e-register-${Date.now()}@example.com`;
      const name = `E2EUser${Date.now()}`;

      await page.goto('/register');
      await page.getByTestId('name-input').fill(name);
      await page.getByTestId('email-input').fill(email);
      await page.getByTestId('password-input').fill('SecurePass123!');
      await page.getByTestId('confirm-password-input').fill('SecurePass123!');
      await page.getByTestId('register-button').click();

      // Registration redirects to the lobby
      await expect(page).toHaveURL(/\/play/);
      await expect(page.getByTestId('user-menu')).toBeVisible();
      await expect(page.getByTestId('user-menu')).toContainText(name);

      // The backend provisions the starter AI file (story 1.4 AC #1) —
      // visible in the teams editor
      await page.getByTestId('nav-teams').click();
      await expect(page.getByTestId('scripts-list')).toContainText('StarterAI.js');
    });

    test('should show error for duplicate email @P1', async ({ page, userFactory }) => {
      const existing = await userFactory.create();

      await page.goto('/register');
      await page.getByTestId('name-input').fill('AnotherUser');
      await page.getByTestId('email-input').fill(existing.email);
      await page.getByTestId('password-input').fill('SecurePass123!');
      await page.getByTestId('confirm-password-input').fill('SecurePass123!');
      await page.getByTestId('register-button').click();

      await expect(page.getByText('Email already registered')).toBeVisible();
      await expect(page).toHaveURL(/\/register/);
    });

    test('should show error for password mismatch @P1', async ({ page }) => {
      await page.goto('/register');
      await page.getByTestId('name-input').fill('MismatchUser');
      await page.getByTestId('email-input').fill(`mismatch-${Date.now()}@example.com`);
      await page.getByTestId('password-input').fill('SecurePass123!');
      await page.getByTestId('confirm-password-input').fill('DifferentPass123!');
      await page.getByTestId('register-button').click();

      await expect(page.getByText('Passwords do not match')).toBeVisible();
      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('Login', () => {
    test('should login with valid credentials and land in the lobby @P0', async ({
      page,
      userFactory,
    }) => {
      const user = await userFactory.create();

      await page.goto('/login');
      await page.getByTestId('email-input').fill(user.email);
      await page.getByTestId('password-input').fill(user.password);
      await page.getByTestId('login-button').click();

      await expect(page).toHaveURL(/\/play/);
      await expect(page.getByTestId('user-menu')).toBeVisible();
      await expect(page.getByTestId('user-menu')).toContainText(user.name);
    });

    test('should show error for invalid credentials @P0', async ({ page, userFactory }) => {
      const user = await userFactory.create();

      await page.goto('/login');
      await page.getByTestId('email-input').fill(user.email);
      await page.getByTestId('password-input').fill('WrongPassword123!');
      await page.getByTestId('login-button').click();

      await expect(page.getByText('Invalid email or password')).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });

    test('should return the user to a deep-linked page after login @P2', async ({
      page,
      userFactory,
    }) => {
      const user = await userFactory.create();

      // A direct visit to /teams while logged out redirects to /login
      await page.goto('/teams');
      await expect(page).toHaveURL(/\/login/);

      await page.getByTestId('email-input').fill(user.email);
      await page.getByTestId('password-input').fill(user.password);
      await page.getByTestId('login-button').click();

      // Login returns the user to /teams, not a hardcoded page
      await expect(page).toHaveURL(/\/teams/);
    });
  });

  test.describe('Logout', () => {
    test('should logout, terminate the session, and redirect to login @P0', async ({
      page,
      userFactory,
    }) => {
      const user = await userFactory.create();
      await seedAuthToken(page, user.token ?? '');

      await page.goto('/teams');
      await expect(page.getByTestId('user-menu')).toBeVisible();

      await page.getByTestId('user-menu').click();
      await page.getByTestId('logout-button').click();

      await expect(page).toHaveURL(/\/login/);

      // The token is gone from localStorage and the app stays logged out
      // after a reload (server-side token was revoked via POST /api/logout).
      const stored = await page.evaluate(() => localStorage.getItem('auth_token'));
      expect(stored).toBeNull();

      await page.goto('/teams');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Protected routes', () => {
    test('should redirect unauthenticated users from teams to login @P0', async ({
      page,
    }) => {
      await page.goto('/teams');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Session persistence', () => {
    test('should keep the user authenticated across page reloads @P0', async ({
      page,
      userFactory,
    }) => {
      const user = await userFactory.create();
      await seedAuthToken(page, user.token ?? '');

      await page.goto('/teams');
      await expect(page.getByTestId('user-menu')).toBeVisible();

      await page.reload();
      await expect(page).toHaveURL(/\/teams/);
      await expect(page.getByTestId('user-menu')).toBeVisible();
    });
  });
});
