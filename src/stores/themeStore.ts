/**
 * Theme Store - La Ronde light/dark theme state (story 7.1)
 * OWNER: Dev Team
 */

import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'lad_theme';

interface ThemeState {
  theme: Theme;
}

interface ThemeActions {
  init: () => void;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
};

const readStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const useThemeStore = create<ThemeState & ThemeActions>((set, get) => ({
  theme: 'light',

  init: () => {
    const theme = readStoredTheme();
    applyTheme(theme);
    set({ theme });
  },

  toggle: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },

  setTheme: (theme) => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage unavailable (private mode, etc.): theme still applies for the session
    }
    set({ theme });
  },
}));
