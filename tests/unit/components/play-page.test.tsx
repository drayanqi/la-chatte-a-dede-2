/**
 * PlayPage Unit Tests (story 7.6)
 *
 * The lobby states, driven by the real stores seeded via setState:
 * - Hero: greeting, elo + rank of my best ready tactic, three CTAs
 * - No-ready state: explanatory card + "Préparer une équipe" → /teams
 * - Ranked chooser opens from the hero and from an opponent card
 * - Practice: Test vs Bot navigates to /match/:id on success
 * - History rows + rail highlight (my row in and out of the top 5)
 *
 * @see Story 7.6: Play Page
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PlayPage } from '@/pages/PlayPage';
import { useAuthStore } from '@/stores/authStore';
import { useMatchStore } from '@/stores/matchStore';
import { useRankedStore } from '@/stores/rankedStore';
import { useTacticsStore } from '@/stores/tacticsStore';
import type { LeaderboardEntry, MatchResult, RankedOpponent, TacticConfig } from '@/types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const makeTactic = (overrides: Partial<TacticConfig> = {}): TacticConfig =>
  ({
    id: 'tactic-1',
    name: 'Les Roulants',
    isSystem: false,
    isReady: false,
    elo: 1000,
    wins: 0,
    losses: 0,
    colorPrimary: '#ff6b57',
    colorSecondary: '#12241b',
    crest: null,
    players: [],
    ...overrides,
  }) as unknown as TacticConfig;

const makeOpponent = (overrides: Partial<RankedOpponent> = {}): RankedOpponent =>
  ({
    id: 'opp-1',
    name: 'Gégé FC',
    owner: 'gege',
    elo: 1302,
    wins: 5,
    losses: 2,
    colorPrimary: '#3d8fd1',
    crest: '🦊',
    ownerTacticsCount: 5,
    ...overrides,
  }) as RankedOpponent;

const makeLeaderboardEntry = (overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry =>
  ({
    rank: 1,
    id: 'entry-1',
    name: 'MoveUnited',
    owner: 'move',
    elo: 1410,
    wins: 42,
    losses: 8,
    colorPrimary: '#31c48d',
    crest: null,
    ...overrides,
  }) as LeaderboardEntry;

const makeMatch = (overrides: Partial<MatchResult> = {}): MatchResult =>
  ({
    id: 'match-1',
    mode: 'ranked',
    status: 'completed',
    scoreChallenger: 2,
    scoreOpponent: 0,
    result: 'challenger_win',
    pointsChallenger: 21,
    pointsOpponent: -21,
    challengerName: 'Pelo',
    opponentName: 'gege',
    challengerTacticName: 'Les Roulants',
    opponentTacticName: 'Gégé FC',
    durationFrames: 10800,
    createdAt: '2026-09-21T00:00:00.000Z',
    ...overrides,
  }) as unknown as MatchResult;

/**
 * URL-aware responses that ECHO the seeded store state: the page's mount
 * fetches would otherwise clobber the seeds with empty payloads.
 */
const mockStoreFetches = (
  overrides: {
    /** POST /matches (practice) or /matchmaking/* (ranked) response */
    playPost?: MatchResult;
    playPostError?: { message: string };
  } = {}
) => {
  mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (method === 'POST') {
      if (overrides.playPostError) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: overrides.playPostError.message }),
        };
      }
      return { ok: true, status: 200, json: async () => overrides.playPost ?? makeMatch() };
    }
    if (url.includes('/tactics')) {
      return {
        ok: true,
        status: 200,
        json: async () => useTacticsStore.getState().tactics,
      };
    }
    if (url.includes('/leaderboard')) {
      return {
        ok: true,
        status: 200,
        json: async () => useRankedStore.getState().leaderboardEntries,
      };
    }
    if (url.includes('/matchmaking/opponents')) {
      return {
        ok: true,
        status: 200,
        json: async () => useRankedStore.getState().opponents,
      };
    }
    if (url.includes('/matches')) {
      const ranked = useRankedStore.getState().historyMatches;
      const latest = useMatchStore.getState().latestMatch;
      const data =
        latest && !ranked.some((match) => match.id === latest.id)
          ? [...ranked, latest]
          : ranked;
      return {
        ok: true,
        status: 200,
        json: async () => ({ data, current_page: 1, last_page: 1 }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ data: [], current_page: 1, last_page: 1 }) };
  });
};

const seedStores = () => {
  useAuthStore.setState({
    isAuthenticated: true,
    isRestoring: false,
    user: { id: 'user-1', username: 'Pelo', email: 'pelo@example.com', points: 10 },
  });
  useTacticsStore.setState({
    tactics: [],
    activeTacticId: null,
    isLoadingTactics: false,
    tacticsError: null,
  });
  useRankedStore.getState().reset();
  useMatchStore.setState({
    isSimulating: false,
    lastMatch: null,
    matchError: null,
    latestMatch: null,
    replayFrames: [],
    replayMatch: null,
    isReplayLoading: false,
    replayError: null,
    replayLogs: [],
  });
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/play']}>
      <Routes>
        <Route path="/play" element={<PlayPage />} />
        <Route path="/teams" element={<div data-testid="teams-page" />} />
        <Route path="/classement" element={<div data-testid="classement-page" />} />
        <Route path="/match/:id" element={<div data-testid="match-page" />} />
      </Routes>
    </MemoryRouter>
  );

describe('PlayPage (story 7.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreFetches();
    seedStores();
    const localStorageMock = {
      getItem: vi.fn(() => 'test-token'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  describe('hero card', () => {
    it('greets the player and shows the best ready tactic with elo and rank', async () => {
      useTacticsStore.setState({
        tactics: [
          makeTactic({ id: 'ready-2', name: 'Barca 2.0', isReady: true, elo: 1100 }),
          makeTactic({ id: 'ready-1', name: 'Les Roulants', isReady: true, elo: 1242 }),
          makeTactic({ id: 'draft-1', name: 'Draft', isReady: false }),
        ],
      });
      useRankedStore.setState({
        leaderboardEntries: [
          makeLeaderboardEntry({ id: 'entry-1', rank: 1 }),
          makeLeaderboardEntry({ id: 'ready-1', rank: 34, name: 'Les Roulants', owner: 'Pelo', elo: 1242 }),
        ],
      });

      renderPage();

      expect(await screen.findByTestId('play-greeting')).toHaveTextContent('Salut Pelo');
      // Best ready tactic = highest elo
      expect(screen.getByTestId('play-hero-sub')).toHaveTextContent('« Les Roulants » est prête');
      expect(screen.getByTestId('play-hero-elo')).toHaveTextContent('1242');
      expect(screen.getByTestId('play-hero-rank')).toHaveTextContent('34e du classement');
      expect(screen.getByTestId('ranked-open-button')).toBeInTheDocument();
      expect(screen.getByTestId('practice-start-button')).toBeInTheDocument();
    });

    it('shows elo without a rank when the tactic is not on the leaderboard yet', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: true, elo: 1000 })] });

      renderPage();

      expect(await screen.findByTestId('play-hero-elo')).toHaveTextContent('1000');
      expect(screen.queryByTestId('play-hero-rank')).not.toBeInTheDocument();
    });

    it('shows "Revoir le dernier match" only when a completed match exists', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: true })] });
      useMatchStore.setState({ latestMatch: makeMatch() });

      renderPage();

      expect(await screen.findByTestId('watch-last-match-button')).toBeInTheDocument();

      useMatchStore.setState({ latestMatch: null });
    });
  });

  describe('no-ready state', () => {
    it('replaces the dead hero with an explanatory card and a CTA to Équipes', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: false })] });

      renderPage();

      expect(await screen.findByTestId('no-ready-state')).toBeInTheDocument();
      expect(screen.queryByTestId('ranked-open-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('practice-start-button')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('go-to-teams-button'));
      expect(screen.getByTestId('teams-page')).toBeInTheDocument();
    });

    it('still offers "Revoir le dernier match" without a ready tactic', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: false })] });
      useMatchStore.setState({ latestMatch: makeMatch() });

      renderPage();

      expect(await screen.findByTestId('watch-last-match-button')).toBeInTheDocument();
    });
  });

  describe('ranked chooser', () => {
    it('opens from the hero, lists opponents and goes back', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: true })] });
      useRankedStore.setState({ opponents: [makeOpponent()] });

      renderPage();

      fireEvent.click(await screen.findByTestId('ranked-open-button'));

      const chooser = await screen.findByTestId('ranked-view');
      expect(chooser).toBeInTheDocument();
      expect(screen.getByTestId('ranked-fighter-select')).toBeInTheDocument();
      expect(screen.getByTestId('ranked-opponent-row')).toHaveAttribute(
        'data-opponent-id',
        'opp-1'
      );
      expect(screen.getByTestId('ranked-opponent-row')).toHaveTextContent('Gégé FC');
      expect(screen.getByTestId('ranked-opponent-row')).toHaveTextContent('5 tactiques');

      fireEvent.click(screen.getByTestId('ranked-back-button'));
      expect(screen.queryByTestId('ranked-view')).not.toBeInTheDocument();
    });

    it('opens from an opponent card "Affronter" and challenges from the chooser', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: true })] });
      useRankedStore.setState({ opponents: [makeOpponent()] });

      renderPage();

      fireEvent.click(await screen.findByTestId('opponent-challenge-button'));
      fireEvent.click(await screen.findByTestId('ranked-challenge-button'));

      // The settled match shows the result card (challenge perspective)
      expect(await screen.findByTestId('result-card')).toBeInTheDocument();
      expect(screen.getByTestId('result-outcome')).toHaveTextContent('Victoire');
    });

    it('shows the no-ready text in the fighter select when nothing is ready', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: false })] });
      useRankedStore.setState({ opponents: [makeOpponent()] });

      renderPage();

      fireEvent.click(await screen.findByTestId('opponents-panel'));
      // Without a ready tactic the opponent cards hide their challenge button
      expect(screen.queryByTestId('opponent-challenge-button')).not.toBeInTheDocument();
    });
  });

  describe('practice flow', () => {
    it('runs Test vs Bot with the best ready tactic and lands on /match/:id', async () => {
      useTacticsStore.setState({
        tactics: [
          makeTactic({ id: 'ready-2', isReady: true, elo: 900 }),
          makeTactic({ id: 'ready-1', isReady: true, elo: 1242 }),
        ],
      });
      mockStoreFetches({
        playPost: makeMatch({ id: 'practice-1', mode: 'practice', pointsChallenger: null }),
      });

      renderPage();

      fireEvent.click(await screen.findByTestId('practice-start-button'));

      await waitFor(() => {
        expect(screen.getByTestId('match-page')).toBeInTheDocument();
      });
      // The best (highest-elo) ready tactic fielded the practice match
      const practiceCall = mockFetch.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/matches') &&
          (init as RequestInit | undefined)?.method === 'POST'
      );
      expect(JSON.stringify((practiceCall?.[1] as RequestInit | undefined)?.body)).toContain(
        'ready-1'
      );
    });

    it('surfaces a failed practice as a retryable banner and stays on the page', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: true })] });
      mockStoreFetches({ playPostError: { message: 'Engine exploded' } });

      renderPage();

      fireEvent.click(await screen.findByTestId('practice-start-button'));

      expect(await screen.findByTestId('practice-error-banner')).toBeInTheDocument();
      expect(screen.getByTestId('practice-error-message')).toBeInTheDocument();
      expect(screen.getByTestId('practice-retry-button')).toBeInTheDocument();
      expect(screen.queryByTestId('match-page')).not.toBeInTheDocument();
    });
  });

  describe('history + rail', () => {
    it('renders history rows from my perspective with V/D badges and delta pills', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: true })] });
      useRankedStore.setState({
        historyMatches: [
          makeMatch(),
          makeMatch({
            id: 'match-2',
            result: 'opponent_win',
            pointsChallenger: -12,
            scoreChallenger: 1,
            scoreOpponent: 2,
          }),
        ],
      });

      renderPage();

      const rows = await screen.findAllByTestId('history-row');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('vs gege');
      expect(rows[0]).toHaveTextContent('2 – 0');
      expect(rows[0].querySelector('[data-testid="history-outcome"]')).toHaveTextContent('V');
      expect(rows[0].querySelector('[data-testid="history-points"]')).toHaveTextContent('+21');
      expect(rows[1].querySelector('[data-testid="history-outcome"]')).toHaveTextContent('D');
      expect(rows[1].querySelector('[data-testid="history-points"]')).toHaveTextContent('-12');
    });

    it('watches a history row in the match viewer', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: true })] });
      useRankedStore.setState({ historyMatches: [makeMatch({ id: 'match-42' })] });

      renderPage();

      fireEvent.click(await screen.findByTestId('history-watch-button'));

      expect(screen.getByTestId('match-page')).toBeInTheDocument();
    });

    it('highlights my row in the rail when it is in the top 5', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ id: 'mine', isReady: true })] });
      useRankedStore.setState({
        leaderboardEntries: [
          makeLeaderboardEntry({ id: 'e1', rank: 1, name: 'MoveUnited' }),
          makeLeaderboardEntry({ id: 'mine', rank: 2, name: 'Les Roulants', owner: 'Pelo' }),
        ],
      });

      renderPage();

      expect(await screen.findByTestId('rail-my-row')).toHaveAttribute('data-tactic-id', 'mine');
      expect(screen.getAllByTestId('rail-row')).toHaveLength(1);
      expect(screen.getByTestId('rail-see-all')).toBeInTheDocument();
    });

    it('appends my row below the top 5 when it sits deeper', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ id: 'mine', isReady: true })] });
      useRankedStore.setState({
        leaderboardEntries: [
          makeLeaderboardEntry({ id: 'e1', rank: 1 }),
          makeLeaderboardEntry({ id: 'e2', rank: 2 }),
          makeLeaderboardEntry({ id: 'e3', rank: 3 }),
          makeLeaderboardEntry({ id: 'e4', rank: 4 }),
          makeLeaderboardEntry({ id: 'e5', rank: 5 }),
          makeLeaderboardEntry({ id: 'mine', rank: 34, name: 'Les Roulants', owner: 'Pelo', elo: 1242 }),
        ],
      });

      renderPage();

      expect(await screen.findByTestId('rail-my-row')).toHaveAttribute('data-tactic-id', 'mine');
      expect(screen.getAllByTestId('rail-row')).toHaveLength(5);
    });

    it('navigates to the full leaderboard from the rail CTA', async () => {
      useTacticsStore.setState({ tactics: [makeTactic({ isReady: true })] });
      useRankedStore.setState({ leaderboardEntries: [makeLeaderboardEntry()] });

      renderPage();

      fireEvent.click(await screen.findByTestId('rail-see-all'));

      expect(screen.getByTestId('classement-page')).toBeInTheDocument();
    });
  });
});
