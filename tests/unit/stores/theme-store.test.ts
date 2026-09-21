/**
 * Theme Store Unit Tests
 *
 * Tests the La Ronde light/dark theme state (story 7.1):
 * - Defaults to light
 * - init() restores the persisted theme and applies data-theme on <html>
 * - toggle() flips and persists
 * - setTheme() persists and tolerates storage failures
 *
 * @see Epic 7: La Ronde UI Refonte
 * @see Story 7.1: Design Tokens & App Shell
 * @priority P1
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from '@/stores/themeStore';

const mockGetItem = vi.fn();
const mockSetItem = vi.fn();

describe('Theme Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: mockGetItem,
        setItem: mockSetItem,
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    // Reset store to defaults before each test
    useThemeStore.setState({ theme: 'light' });
    delete document.documentElement.dataset.theme;
  });

  describe('initial state', () => {
    it('should default to light', () => {
      expect(useThemeStore.getState().theme).toBe('light');
    });

    it('should default to light when nothing is stored', () => {
      mockGetItem.mockReturnValue(null);

      useThemeStore.getState().init();

      expect(useThemeStore.getState().theme).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  describe('init()', () => {
    it('should restore a persisted dark theme', () => {
      mockGetItem.mockReturnValue('dark');

      useThemeStore.getState().init();

      expect(useThemeStore.getState().theme).toBe('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('should fall back to light on an unknown stored value', () => {
      mockGetItem.mockReturnValue('midnight');

      useThemeStore.getState().init();

      expect(useThemeStore.getState().theme).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  describe('toggle()', () => {
    it('should flip light to dark, persist and apply', () => {
      useThemeStore.getState().init();

      useThemeStore.getState().toggle();

      expect(useThemeStore.getState().theme).toBe('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(mockSetItem).toHaveBeenCalledWith('lad_theme', 'dark');
    });

    it('should flip dark back to light', () => {
      useThemeStore.setState({ theme: 'dark' });

      useThemeStore.getState().toggle();

      expect(useThemeStore.getState().theme).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(mockSetItem).toHaveBeenCalledWith('lad_theme', 'light');
    });
  });

  describe('setTheme()', () => {
    it('should apply and persist the requested theme', () => {
      useThemeStore.getState().setTheme('dark');

      expect(useThemeStore.getState().theme).toBe('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(mockSetItem).toHaveBeenCalledWith('lad_theme', 'dark');
    });

    it('should still apply the theme when storage throws', () => {
      mockSetItem.mockImplementation(() => {
        throw new Error('storage unavailable');
      });

      useThemeStore.getState().setTheme('dark');

      expect(useThemeStore.getState().theme).toBe('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
  });
});
