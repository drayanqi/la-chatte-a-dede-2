/**
 * App Route Smoke Tests
 *
 * Tests the La Ronde routing table (story 7.2):
 * - `/` redirects to /play
 * - `/play` renders the lobby stub (ranked-open-button)
 * - `/palmares` renders the placeholder
 * - `/classement` renders the leaderboard page
 * - Protected routes redirect unauthenticated visitors to /login
 * - The legacy /workspace path falls through to /play
 *
 * TeamsPage and MatchPage mount the canvas/editor stack — covered by the
 * e2e suite instead of jsdom.
 *
 * @see Epic 7: La Ronde UI Refonte
 * @see Story 7.2: Navigation & Three Routes
 * @priority P1
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '@/App';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Light page stubs: the routing table is under test, not the pages.
// (TeamsPage/MatchPage mount the canvas/editor stack — jsdom-hostile, and
// covered by the e2e suite instead.)
vi.mock('@/pages', () => ({
  LoginPage: () => <div>login-page</div>,
  RegisterPage: () => <div>register-page</div>,
  PlayPage: () => (
    <button type="button" data-testid="ranked-open-button">
      Match classé
    </button>
  ),
  TeamsPage: () => <div data-testid="teams-page">teams</div>,
  MatchPage: () => <div data-testid="match-page">match</div>,
  PalmaresPage: () => <h1>Palmarès</h1>,
  LeaderboardPage: () => <div data-testid="leaderboard-view">classement</div>,
}));

const navigateTo = (path: string) => {
  window.history.pushState({}, '', path);
};

describe('App Routes (La Ronde)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    useThemeStore.setState({ theme: 'light' });
    useAuthStore.getState().reset();
    useAuthStore.setState({
      isAuthenticated: true,
      isRestoring: false,
      user: { id: 'user-1', username: 'Pelo', email: 'pelo@example.com', points: 1240 },
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('should render the play stub on /', async () => {
    navigateTo('/');

    render(<App />);

    expect(await screen.findByTestId('ranked-open-button')).toBeInTheDocument();
  });

  it('should render the palmares placeholder on /palmares', async () => {
    navigateTo('/palmares');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Palmarès' })).toBeInTheDocument();
  });

  it('should render the leaderboard page on /classement', async () => {
    navigateTo('/classement');

    render(<App />);

    expect(await screen.findByTestId('leaderboard-view')).toBeInTheDocument();
  });

  it('should fall through from the legacy /workspace path to /play', async () => {
    navigateTo('/workspace');

    render(<App />);

    expect(await screen.findByTestId('ranked-open-button')).toBeInTheDocument();
  });

  it('should redirect unauthenticated visitors from /play to /login', async () => {
    useAuthStore.setState({ isAuthenticated: false, isRestoring: false, user: null });
    navigateTo('/play');

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
  });

  it('should keep the login route public', async () => {
    useAuthStore.setState({ isAuthenticated: false, isRestoring: false, user: null });
    navigateTo('/login');

    render(<App />);

    expect(await screen.findByText('login-page')).toBeInTheDocument();
  });
});
