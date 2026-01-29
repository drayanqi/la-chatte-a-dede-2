/**
 * Auth Store - Authentication state management
 * OWNER: Dev Team
 */

import { create } from 'zustand';

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

const API_URL = import.meta.env.VITE_API_URL || '/api';

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
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include', // Include cookies in request
        body: JSON.stringify({
          email,
          password,
          password_confirmation: passwordConfirmation,
          name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        set({ error: data.message, isLoading: false });
        return;
      }

      // Token is stored in HTTP-only cookie by server
      // Store token in memory for API calls
      localStorage.setItem('auth_token', data.token);

      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Registration error:', error);
      set({ error: 'Registration failed. Please try again.', isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include', // Include cookies in request
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        set({ error: data.message, isLoading: false });
        return;
      }

      // Token is stored in HTTP-only cookie by server
      // Store token in memory for API calls
      localStorage.setItem('auth_token', data.token);

      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Login error:', error);
      set({ error: 'Login failed. Please try again.', isLoading: false });
    }
  },

  logout: () => {
    // Clear stored token
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
      const response = await fetch(`${API_URL}/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        // Token is invalid, clear it
        localStorage.removeItem('auth_token');
        set({ isRestoring: false });
        return;
      }

      const user = await response.json();
      set({
        user,
        isAuthenticated: true,
        isRestoring: false,
      });
    } catch (error) {
      console.error('Session restoration error:', error);
      localStorage.removeItem('auth_token');
      set({ isRestoring: false });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ ...initialState, isRestoring: false }),
}));

