/**
 * Appbar Component Unit Tests
 *
 * Tests the La Ronde floating navigation capsule (story 7.1):
 * - Renders the four nav links with their testids and labels
 * - Logo links to /play
 * - Theme toggle flips the theme store
 * - User menu: username in the trigger, dropdown with email/points,
 *   logout clears the session and lands on /login, Escape closes
 *
 * @see Epic 7: La Ronde UI Refonte
 * @see Story 7.1: Design Tokens & App Shell
 * @priority P1
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Appbar } from '@/components/layout/Appbar';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const renderAppbar = (initialPath = '/play') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="*" element={<Appbar />} />
      </Routes>
    </MemoryRouter>
  );

describe('Appbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    useThemeStore.setState({ theme: 'light' });
    useAuthStore.getState().reset();
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'user-1',
        username: 'Pelo',
        email: 'pelo@example.com',
        points: 1240,
      },
    });
  });

  it('should render the five nav links with labels and testids', () => {
    renderAppbar();

    expect(screen.getByTestId('nav-play')).toHaveTextContent('Jouer');
    expect(screen.getByTestId('nav-teams')).toHaveTextContent('Équipes');
    expect(screen.getByTestId('nav-palmares')).toHaveTextContent('Palmarès');
    expect(screen.getByTestId('nav-leaderboard')).toHaveTextContent('Classement');
    expect(screen.getByTestId('nav-guide')).toHaveTextContent('Guide');
  });

  it('should link the logo back to /play', () => {
    renderAppbar('/teams');

    const logo = screen.getByRole('link', { name: /LACHATADEDE/i });
    expect(logo).toHaveAttribute('href', '/play');
  });

  it('should contain the full username in the user-menu trigger', () => {
    renderAppbar();

    const userMenu = screen.getByTestId('user-menu');
    expect(userMenu).toHaveTextContent('Pelo');
  });

  it('should toggle the theme on theme-toggle click', () => {
    renderAppbar();

    const toggle = screen.getByTestId('theme-toggle');
    expect(toggle).toHaveAttribute('aria-label', 'Activer le thème sombre');

    fireEvent.click(toggle);

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(toggle).toHaveAttribute('aria-label', 'Activer le thème clair');

    fireEvent.click(toggle);

    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('should open the user menu with email, points and logout', () => {
    renderAppbar();

    fireEvent.click(screen.getByTestId('user-menu'));

    expect(screen.getByText('pelo@example.com')).toBeInTheDocument();
    expect(screen.getByText('1240 pts')).toBeInTheDocument();
    expect(screen.getByTestId('logout-button')).toBeInTheDocument();
  });

  it('should logout and land on /login', () => {
    renderAppbar();

    fireEvent.click(screen.getByTestId('user-menu'));
    fireEvent.click(screen.getByTestId('logout-button'));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('should close the menu on Escape', () => {
    renderAppbar();

    fireEvent.click(screen.getByTestId('user-menu'));
    expect(screen.getByTestId('logout-button')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('logout-button')).not.toBeInTheDocument();
  });

  it('should hide the user section when unauthenticated', () => {
    useAuthStore.setState({ isAuthenticated: false, user: null });

    renderAppbar();

    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
  });
});
