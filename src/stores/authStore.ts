/**
 * Auth Store - Authentication state management
 * OWNER: Dev Team
 */

import { create } from 'zustand';
import { apiFetch, ApiError } from '@/lib/apiClient';

export interface User {
  id: string;
  email: string;
  username: string;
  points: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoring: boolean;
  error: string | null;
}

interface AuthActions {
  register: (
    email: string,
    password: string,
    passwordConfirmation: string,
    name: string
  ) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isRestoring: true, // Start as true until session check completes
  error: null,
};

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  ...initialState,

  register: async (email, password, passwordConfirmation, name) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          password_confirmation: passwordConfirmation,
          name,
        }),
      });

      const data = await response.json();

      // The API also sets an HTTP-only cookie as a secondary mechanism; the
      // bearer token in localStorage is what this app actually authenticates with.
      localStorage.setItem('auth_token', data.token);

      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        set({ error: error.message || 'Authentication failed. Please try again.', isLoading: false });
        return;
      }
      console.error('Registration error:', error);
      set({ error: 'Registration failed. Please try again.', isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      // The API also sets an HTTP-only cookie as a secondary mechanism; the
      // bearer token in localStorage is what this app actually authenticates with.
      localStorage.setItem('auth_token', data.token);

      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        set({ error: error.message || 'Authentication failed. Please try again.', isLoading: false });
        return;
      }
      console.error('Login error:', error);
      set({ error: 'Login failed. Please try again.', isLoading: false });
    }
  },

  logout: () => {
    // Terminate the server-side session (fire-and-forget: local state must
    // clear even if the request fails). The store no longer holds the token
    // after this call, so capture it first for the Authorization header.
    const token = localStorage.getItem('auth_token');

    if (token) {
      void apiFetch('/logout', { method: 'POST' }).catch(() => {});
    }

    localStorage.removeItem('auth_token');
    set({ ...initialState, isRestoring: false });
  },

  restoreSession: async () => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ isRestoring: false });
      return;
    }

    try {
      const response = await apiFetch('/user');
      const user = await response.json();
      set({
        user,
        isAuthenticated: true,
        isRestoring: false,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Definitive rejection: the token is no longer valid, clear it
        localStorage.removeItem('auth_token');
      } else {
        // Transient HTTP failure (5xx/429) or network/transport failure: the
        // token may still be valid, keep it and let the user retry rather than
        // logging them out of a transient outage.
        console.error('Session restoration error:', error);
      }
      set({ isRestoring: false });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ ...initialState, isRestoring: false }),
}));
