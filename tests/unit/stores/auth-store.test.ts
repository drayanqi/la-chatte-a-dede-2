/**
 * Auth Store Unit Tests
 *
 * Tests authentication state management including registration,
 * login, logout, and error handling.
 *
 * @see Epic 1: User Authentication & Onboarding
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.getState().reset();
    // Clear all mocks
    vi.clearAllMocks();
    // Mock document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have null user initially', () => {
      // GIVEN: Fresh store
      const state = useAuthStore.getState();

      // THEN: User should be null
      expect(state.user).toBeNull();
    });

    it('should not be authenticated initially', () => {
      // GIVEN: Fresh store
      const state = useAuthStore.getState();

      // THEN: Should not be authenticated
      expect(state.isAuthenticated).toBe(false);
    });

    it('should not be loading initially', () => {
      // GIVEN: Fresh store
      const state = useAuthStore.getState();

      // THEN: Should not be loading
      expect(state.isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      // GIVEN: Fresh store
      const state = useAuthStore.getState();

      // THEN: Should have no error
      expect(state.error).toBeNull();
    });
  });

  describe('Registration', () => {
    it('should register new user with valid credentials', async () => {
      // GIVEN: Initial unauthenticated state
      const store = useAuthStore.getState();
      expect(store.isAuthenticated).toBe(false);

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              id: 'uuid-123',
              email: 'test@example.com',
              username: 'Test User',
              points: 0,
            },
            token: 'test-token-abc',
          }),
      });

      // WHEN: Registering with valid email and password
      await store.register(
        'test@example.com',
        'Password123!',
        'Password123!',
        'Test User'
      );

      // THEN: User should be authenticated
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('test@example.com');
      expect(state.user?.username).toBe('Test User');
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should show error for duplicate email', async () => {
      // GIVEN: API returns duplicate email error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            message: 'Email already registered',
            errors: { email: ['The email has already been taken.'] },
          }),
      });

      // WHEN: Attempting to register with existing email
      await useAuthStore
        .getState()
        .register(
          'existing@example.com',
          'Password123!',
          'Password123!',
          'Test User'
        );

      // THEN: Error should be set
      const state = useAuthStore.getState();
      expect(state.error).toBe('Email already registered');
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should show error for password mismatch', async () => {
      // GIVEN: API returns password mismatch error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            message: 'Passwords do not match',
            errors: { password: ['The password confirmation does not match.'] },
          }),
      });

      // WHEN: Attempting to register with mismatched passwords
      await useAuthStore
        .getState()
        .register(
          'test@example.com',
          'Password123!',
          'DifferentPass!',
          'Test User'
        );

      // THEN: Error should be set
      const state = useAuthStore.getState();
      expect(state.error).toBe('Passwords do not match');
      expect(state.isAuthenticated).toBe(false);
    });

    it('should set loading state during registration', async () => {
      // GIVEN: Initial state
      const store = useAuthStore.getState();
      expect(store.isLoading).toBe(false);

      // Create a promise that we can control
      let resolvePromise: (value: unknown) => void;
      const controlledPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(controlledPromise);

      // WHEN: Starting registration
      const registerPromise = store.register(
        'test@example.com',
        'Password123!',
        'Password123!',
        'Test User'
      );

      // THEN: Should be loading
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Resolve the promise to complete the test
      resolvePromise!({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { id: '1', email: 'test@example.com', username: 'Test', points: 0 },
            token: 'token',
          }),
      });

      await registerPromise;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should handle network error gracefully', async () => {
      // GIVEN: Network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // WHEN: Attempting to register
      await useAuthStore
        .getState()
        .register('test@example.com', 'Password123!', 'Password123!', 'Test User');

      // THEN: Should show generic error
      const state = useAuthStore.getState();
      expect(state.error).toBe('Registration failed. Please try again.');
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('Login', () => {
    it('should login user with valid credentials', async () => {
      // GIVEN: User exists
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              id: 'uuid-123',
              email: 'test@example.com',
              username: 'Test User',
              points: 100,
            },
            token: 'login-token',
          }),
      });

      // WHEN: Logging in with valid credentials
      await useAuthStore.getState().login('test@example.com', 'Password123!');

      // THEN: Should be authenticated
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('test@example.com');
      expect(state.user?.points).toBe(100);
      expect(state.error).toBeNull();
    });

    it('should show error for invalid credentials', async () => {
      // GIVEN: Invalid credentials
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            message: 'Invalid email or password',
            errors: { email: ['The provided credentials are incorrect.'] },
          }),
      });

      // WHEN: Attempting to login with wrong password
      await useAuthStore.getState().login('test@example.com', 'WrongPassword!');

      // THEN: Error should be set
      const state = useAuthStore.getState();
      expect(state.error).toBe('Invalid email or password');
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should logout and clear user state', async () => {
      // GIVEN: Authenticated user
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { id: '1', email: 'test@example.com', username: 'Test', points: 0 },
            token: 'token',
          }),
      });
      await useAuthStore.getState().login('test@example.com', 'Password123!');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // WHEN: Logging out
      useAuthStore.getState().logout();

      // THEN: Should be logged out
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should clear error with clearError()', async () => {
      // GIVEN: Error state
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Some error' }),
      });
      await useAuthStore
        .getState()
        .register('test@example.com', 'short', 'short', 'Test');
      expect(useAuthStore.getState().error).not.toBeNull();

      // WHEN: Clearing error
      useAuthStore.getState().clearError();

      // THEN: Error should be cleared
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', async () => {
      // GIVEN: Authenticated user with error
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { id: '1', email: 'test@example.com', username: 'Test', points: 0 },
            token: 'token',
          }),
      });
      await useAuthStore.getState().login('test@example.com', 'Password123!');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // WHEN: Resetting
      useAuthStore.getState().reset();

      // THEN: Should be in initial state
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
