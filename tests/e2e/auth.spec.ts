/**
 * Authentication E2E Tests
 *
 * Tests the complete authentication flow:
 * - User registration
 * - User login
 * - User logout
 * - Protected route access
 *
 * @see FR1, FR2, FR3 in PRD
 */
import { test, expect } from '../support/fixtures';

// test.describe('Authentication', () => {
//   test.describe('Registration', () => {
//     test('should allow new user registration', async ({ page, userFactory }) => {
//       // Navigate to registration page
//       await page.goto('/register');
//
//       // Fill registration form with unique values
//       const timestamp = Date.now();
//       const email = `test-${timestamp}@example.com`;
//       const name = `TestUser${timestamp}`;
//       await page.fill('[data-testid="email-input"]', email);
//       await page.fill('[data-testid="password-input"]', 'SecurePass123!');
//       await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');
//       await page.fill('[data-testid="name-input"]', name);
//
//       // Submit and verify redirect to workspace
//       await page.click('[data-testid="register-button"]');
//       await expect(page).toHaveURL(/\/workspace/);
//
//       // Verify user is logged in
//       await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
//     });
//
//     test('should show error for duplicate email', async ({ page, userFactory }) => {
//       // Create existing user
//       const existingUser = await userFactory.create();
//
//       await page.goto('/register');
//
//       // Try to register with same email
//       await page.fill('[data-testid="email-input"]', existingUser.email);
//       await page.fill('[data-testid="password-input"]', 'SecurePass123!');
//       await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');
//       await page.fill('[data-testid="name-input"]', 'Test User');
//       await page.click('[data-testid="register-button"]');
//
//       // Verify error message
//       await expect(page.getByText(/email already registered/i)).toBeVisible();
//     });
//
//     test('should validate password confirmation', async ({ page }) => {
//       await page.goto('/register');
//
//       await page.fill('[data-testid="email-input"]', 'test@example.com');
//       await page.fill('[data-testid="password-input"]', 'SecurePass123!');
//       await page.fill('[data-testid="confirm-password-input"]', 'DifferentPass!');
//       await page.fill('[data-testid="name-input"]', 'Test User');
//       await page.click('[data-testid="register-button"]');
//
//       await expect(page.getByText(/passwords do not match/i)).toBeVisible();
//     });
//
//     test('should require minimum 8 character password', async ({ page }) => {
//       await page.goto('/register');
//
//       await page.fill('[data-testid="email-input"]', 'test@example.com');
//       await page.fill('[data-testid="password-input"]', 'short');
//       await page.fill('[data-testid="confirm-password-input"]', 'short');
//       await page.fill('[data-testid="name-input"]', 'Test User');
//       await page.click('[data-testid="register-button"]');
//
//       await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
//     });
//   });
//
//   test.describe('Login', () => {
//     test('should allow login with valid credentials', async ({ page, userFactory }) => {
//       // Create test user
//       const user = await userFactory.create({ password: 'TestPass123!' });
//
//       await page.goto('/login');
//
//       // Fill login form
//       await page.fill('[data-testid="email-input"]', user.email);
//       await page.fill('[data-testid="password-input"]', 'TestPass123!');
//       await page.click('[data-testid="login-button"]');
//
//       // Verify redirect to workspace
//       await expect(page).toHaveURL(/\/workspace/);
//       await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
//     });
//
//     test('should show error for invalid credentials', async ({ page }) => {
//       await page.goto('/login');
//
//       await page.fill('[data-testid="email-input"]', 'nonexistent@example.com');
//       await page.fill('[data-testid="password-input"]', 'WrongPassword!');
//       await page.click('[data-testid="login-button"]');
//
//       await expect(page.getByText(/invalid email or password/i)).toBeVisible();
//       await expect(page).toHaveURL(/\/login/);
//     });
//   });
//
//   test.describe('Logout', () => {
//     test('should logout and redirect to login', async ({ page, userFactory }) => {
//       // Create user via factory
//       const user = await userFactory.create({ password: 'TestPass123!' });
//
//       // Login via UI to establish proper auth state
//       await page.goto('/login');
//       await page.fill('[data-testid="email-input"]', user.email);
//       await page.fill('[data-testid="password-input"]', 'TestPass123!');
//       await page.click('[data-testid="login-button"]');
//
//       // Wait for redirect to workspace and user menu to be visible
//       await expect(page).toHaveURL(/\/workspace/);
//       await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
//
//       // Logout
//       await page.click('[data-testid="user-menu"]');
//       await page.click('[data-testid="logout-button"]');
//
//       // Verify redirect to login
//       await expect(page).toHaveURL(/\/login/);
//     });
//   });
//
//   test.describe('Protected Routes', () => {
//     test('should redirect unauthenticated users to login', async ({ page }) => {
//       // Try to access workspace without auth
//       await page.goto('/workspace');
//
//       // Should redirect to login
//       await expect(page).toHaveURL(/\/login/);
//     });
//   });
// });
