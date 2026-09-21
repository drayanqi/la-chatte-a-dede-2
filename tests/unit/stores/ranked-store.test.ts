/**
 * Ranked Store Unit Tests (Epic 4 v2, story 4.3)
 *
 * Tests the ranked matchmaking store:
 * - Opponents pool: fetch mapping, error surface, dead-session logout
 * - Quick match: happy path (match + pool/tactics refresh), empty-pool 404
 *   message, failure paths
 * - Challenge: happy path + 401 logout
 * - clearResult / reset
 *
 * @see Epic 4 v2: Ranked Competition — Ready Tactics & Challenge Mode
 * @see Story 4.3: Ranked Matchmaking View
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useRankedStore } from '@/stores/rankedStore';
import { useTacticsStore } from '@/stores/tacticsStore';
import { ApiError } from '@/lib/apiClient';
import type { LeaderboardEntry, RankedOpponent, TacticConfig } from '@/types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const makeOpponent = (overrides: Partial<RankedOpponent> = {}): RankedOpponent => ({
  id: 'opp-1',
  name: 'Rival Tactic',
  owner: 'rival',
  elo: 1043,
  wins: 2,
  losses: 1,
  ...overrides,
});

const makeLeaderboardEntry = (overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  rank: 1,
  id: 'entry-1',
  name: 'Top Tactic',
  owner: 'champ',
  elo: 1300,
  wins: 5,
  losses: 0,
  ...overrides,
});

const makeMatch = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'match-1',
  mode: 'ranked',
  status: 'completed',
  scoreChallenger: 2,
  scoreOpponent: 1,
  result: 'challenger_win',
  pointsChallenger: 25,
  pointsOpponent: -25,
  challengerName: 'me',
  opponentName: 'rival',
  durationFrames: 10800,
  createdAt: '2026-09-19T00:00:00.000Z',
  ...overrides,
});

const makeTactic = (overrides: Partial<TacticConfig> = {}): TacticConfig => ({
  id: 'tactic-1',
  name: 'Tactic 1',
  isSystem: false,
  isReady: true,
  elo: 1000,
  wins: 0,
  losses: 0,
  players: [],
  ...overrides,
});

describe('RankedStore', () => {
  beforeEach(() => {
    useRankedStore.getState().reset();
    useTacticsStore.setState({ tactics: [makeTactic()] });
    vi.clearAllMocks();
    const localStorageMock = {
      getItem: vi.fn(() => 'test-token'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  describe('fetchOpponents', () => {
    it('should fetch and store the opponents pool', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [makeOpponent(), makeOpponent({ id: 'opp-2', elo: 900 })],
      });

      await useRankedStore.getState().fetchOpponents();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/matchmaking/opponents'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
      );
      expect(useRankedStore.getState().opponents).toHaveLength(2);
      expect(useRankedStore.getState().isLoadingOpponents).toBe(false);
      expect(useRankedStore.getState().opponentsError).toBeNull();
    });

    it('should surface the API message on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server exploded' }),
      });

      await useRankedStore.getState().fetchOpponents();

      expect(useRankedStore.getState().opponentsError).toBe('Server exploded');
      expect(useRankedStore.getState().isLoadingOpponents).toBe(false);
    });

    it('should fall back to a human message on non-JSON failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json');
        },
      });

      await useRankedStore.getState().fetchOpponents();

      expect(useRankedStore.getState().opponentsError).toBe(
        'Could not load opponents. Please try again.'
      );
    });

    it('should log out on a dead session', async () => {
      const logoutSpy = vi.fn();
      const authStore = await import('@/stores/authStore');
      vi.spyOn(authStore.useAuthStore.getState(), 'logout').mockImplementation(logoutSpy);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthenticated.' }),
      });

      await useRankedStore.getState().fetchOpponents();

      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  describe('quickMatch', () => {
    it('should play a quick match and refresh pool + tactic records', async () => {
      mockFetch
        // POST /matchmaking/quick
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => makeMatch(),
        })
        // refresh: GET /matchmaking/opponents
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [makeOpponent()],
        })
        // refresh: GET /tactics
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [makeTactic({ elo: 1025, wins: 1 })],
        });

      await useRankedStore.getState().quickMatch('tactic-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/matchmaking/quick'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ tactic_id: 'tactic-1' }),
        })
      );
      expect(useRankedStore.getState().match?.pointsChallenger).toBe(25);
      expect(useRankedStore.getState().isPlaying).toBe(false);
      expect(useRankedStore.getState().activeTacticId).toBe('tactic-1');
      expect(useRankedStore.getState().opponentTacticId).toBeNull();

      // The record on the tab followed the server (refresh is fire-and-forget)
      await waitFor(() => {
        expect(useTacticsStore.getState().tactics[0].elo).toBe(1025);
      });
    });

    it('should surface "No opponents ready" from the 404 body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'No opponents ready' }),
      });

      await useRankedStore.getState().quickMatch('tactic-1');

      expect(useRankedStore.getState().matchError).toBe('No opponents ready');
      expect(useRankedStore.getState().match).toBeNull();
      expect(useRankedStore.getState().isPlaying).toBe(false);
    });

    it('should surface a 502 simulation failure message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ message: 'Simulation failed' }),
      });

      await useRankedStore.getState().quickMatch('tactic-1');

      expect(useRankedStore.getState().matchError).toBe('Simulation failed');
    });

    it('should fall back to a human message on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await useRankedStore.getState().quickMatch('tactic-1');

      expect(useRankedStore.getState().matchError).toBe(
        'Could not start the match. Please try again.'
      );
    });
  });

  describe('challenge', () => {
    it('should challenge a specific opponent and store the match', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => makeMatch({ pointsChallenger: -25, result: 'opponent_win' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [makeOpponent()],
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [makeTactic({ elo: 975, losses: 1 })],
        });

      await useRankedStore.getState().challenge('tactic-1', 'opp-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/matchmaking/challenge'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ tactic_id: 'tactic-1', opponent_tactic_id: 'opp-1' }),
        })
      );
      expect(useRankedStore.getState().match?.result).toBe('opponent_win');
      expect(useRankedStore.getState().opponentTacticId).toBe('opp-1');
    });

    it('should refuse a 422 challenge with the server message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'You cannot challenge your own tactic' }),
      });

      await useRankedStore.getState().challenge('tactic-1', 'opp-1');

      expect(useRankedStore.getState().matchError).toBe(
        'You cannot challenge your own tactic'
      );
    });

    it('should log out on a dead session', async () => {
      const authStore = await import('@/stores/authStore');
      const logoutSpy = vi.spyOn(authStore.useAuthStore.getState(), 'logout');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthenticated.' }),
      });

      await useRankedStore.getState().challenge('tactic-1', 'opp-1');

      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  describe('superseded responses', () => {
    it('should ignore a stale response superseded by a newer play', async () => {
      // First call hangs until we resolve it manually; second call resolves
      // immediately with a different match
      let resolveFirst: (value: unknown) => void = () => {};
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => makeMatch({ id: 'match-second' }),
      });
      // Refreshes for the second play
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      const first = useRankedStore.getState().quickMatch('tactic-1');
      const second = useRankedStore.getState().quickMatch('tactic-1');
      await second;

      // The stale first response lands after the second settled
      resolveFirst({
        ok: true,
        status: 201,
        json: async () => makeMatch({ id: 'match-first' }),
      });
      await first;

      expect(useRankedStore.getState().match?.id).toBe('match-second');
    });
  });

  describe('clearResult / reset', () => {
    it('should clear the result banner but keep the pool', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [makeOpponent()],
      });
      await useRankedStore.getState().fetchOpponents();

      useRankedStore.setState({ match: makeMatch() as never, matchError: 'boom' });
      useRankedStore.getState().clearResult();

      expect(useRankedStore.getState().match).toBeNull();
      expect(useRankedStore.getState().matchError).toBeNull();
      expect(useRankedStore.getState().opponents).toHaveLength(1);
    });

    it('should reset everything', () => {
      useRankedStore.setState({ match: makeMatch() as never, opponents: [makeOpponent()] });
      useRankedStore.getState().reset();

      expect(useRankedStore.getState().opponents).toEqual([]);
      expect(useRankedStore.getState().match).toBeNull();
      expect(useRankedStore.getState().hasLoadedOpponents).toBe(false);
    });
  });

  describe('fetchHistory (story 4.4)', () => {
    const makePage = (
      matches: ReturnType<typeof makeMatch>[],
      currentPage: number,
      lastPage: number
    ) => ({ data: matches, current_page: currentPage, last_page: lastPage });

    it('should fetch ranked history page 1 and replace the slice', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makePage([makeMatch()], 1, 3),
      });

      await useRankedStore.getState().fetchHistory();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/matches?mode=ranked'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
      );
      expect(useRankedStore.getState().historyMatches).toHaveLength(1);
      expect(useRankedStore.getState().historyPage).toBe(1);
      expect(useRankedStore.getState().historyLastPage).toBe(3);
      expect(useRankedStore.getState().historyTacticId).toBeNull();
      expect(useRankedStore.getState().isLoadingHistory).toBe(false);
      expect(useRankedStore.getState().historyError).toBeNull();
    });

    it('should pass the tactic filter through to the endpoint (AC #2)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makePage([], 1, 1),
      });

      await useRankedStore.getState().fetchHistory('tactic-9');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/matches?mode=ranked&tactic_id=tactic-9'),
        expect.anything()
      );
      expect(useRankedStore.getState().historyTacticId).toBe('tactic-9');
    });

    it('should surface the API message on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server exploded' }),
      });

      await useRankedStore.getState().fetchHistory();

      expect(useRankedStore.getState().historyError).toBe('Server exploded');
      expect(useRankedStore.getState().isLoadingHistory).toBe(false);
    });

    it('should fall back to a human message on non-JSON failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json');
        },
      });

      await useRankedStore.getState().fetchHistory();

      expect(useRankedStore.getState().historyError).toBe(
        'Could not load match history. Please try again.'
      );
    });

    it('should log out on a dead session', async () => {
      const logoutSpy = vi.fn();
      const authStore = await import('@/stores/authStore');
      const spy = vi
        .spyOn(authStore.useAuthStore.getState(), 'logout')
        .mockImplementation(logoutSpy);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthenticated.' }),
      });

      await useRankedStore.getState().fetchHistory();

      expect(logoutSpy).toHaveBeenCalled();
      // The slice must not spin even if logout stops resetting the ranked store
      expect(useRankedStore.getState().isLoadingHistory).toBe(false);
      expect(useRankedStore.getState().isLoadingMoreHistory).toBe(false);

      spy.mockRestore();
      expect(authStore.useAuthStore.getState().logout).not.toBe(logoutSpy);
    });
  });

  describe('loadMoreHistory (story 4.4)', () => {
    const makePage = (
      matches: ReturnType<typeof makeMatch>[],
      currentPage: number,
      lastPage: number
    ) => ({ data: matches, current_page: currentPage, last_page: lastPage });

    it('should append the next page when more pages remain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makePage([makeMatch({ id: 'match-1' })], 1, 2),
      });
      await useRankedStore.getState().fetchHistory();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makePage([makeMatch({ id: 'match-2' })], 2, 2),
      });
      await useRankedStore.getState().loadMoreHistory();

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/matches?mode=ranked&page=2'),
        expect.anything()
      );
      expect(useRankedStore.getState().historyMatches.map((m) => m.id)).toEqual([
        'match-1',
        'match-2',
      ]);
      expect(useRankedStore.getState().historyPage).toBe(2);
      expect(useRankedStore.getState().isLoadingHistory).toBe(false);
      expect(useRankedStore.getState().isLoadingMoreHistory).toBe(false);
    });

    it('should no-op when the last page is already loaded', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makePage([makeMatch()], 1, 1),
      });
      await useRankedStore.getState().fetchHistory();

      await useRankedStore.getState().loadMoreHistory();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should drop a stale append superseded by a page-1 refetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makePage([makeMatch({ id: 'match-1' })], 1, 2),
      });
      await useRankedStore.getState().fetchHistory();

      // The load-more hangs until we resolve it manually...
      let resolveLoadMore: (value: unknown) => void = () => {};
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLoadMore = resolve;
          })
      );
      const pending = useRankedStore.getState().loadMoreHistory();

      // ...meanwhile the user changes the filter: page 1 is replaced
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makePage([makeMatch({ id: 'match-filtered' })], 1, 1),
      });
      await useRankedStore.getState().fetchHistory('tactic-9');

      // The stale page-2 response lands last — it must NOT append
      resolveLoadMore({
        ok: true,
        status: 200,
        json: async () => makePage([makeMatch({ id: 'match-stale' })], 2, 2),
      });
      await pending;

      expect(useRankedStore.getState().historyMatches.map((m) => m.id)).toEqual([
        'match-filtered',
      ]);
      expect(useRankedStore.getState().historyPage).toBe(1);
      expect(useRankedStore.getState().historyTacticId).toBe('tactic-9');
    });
  });

  describe('fetchLeaderboard (story 4.5)', () => {
    it('should fetch the board and keep the server order as-received', async () => {
      const board = [
        makeLeaderboardEntry(),
        makeLeaderboardEntry({ rank: 2, id: 'entry-2', name: 'Second', elo: 900 }),
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        // Deliberately NOT elo-sorted: the client renders payload order,
        // the server owns ranking
        json: async () => board,
      });

      await useRankedStore.getState().fetchLeaderboard();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/leaderboard'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
      );
      expect(useRankedStore.getState().leaderboardEntries).toEqual(board);
      expect(useRankedStore.getState().leaderboardEntries.map((entry) => entry.id)).toEqual([
        'entry-1',
        'entry-2',
      ]);
      expect(useRankedStore.getState().isLoadingLeaderboard).toBe(false);
      expect(useRankedStore.getState().leaderboardError).toBeNull();
    });

    it('should surface the API message on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server exploded' }),
      });

      await useRankedStore.getState().fetchLeaderboard();

      expect(useRankedStore.getState().leaderboardError).toBe('Server exploded');
      expect(useRankedStore.getState().isLoadingLeaderboard).toBe(false);
    });

    it('should fall back to a human message on non-JSON failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json');
        },
      });

      await useRankedStore.getState().fetchLeaderboard();

      expect(useRankedStore.getState().leaderboardError).toBe(
        'Could not load the leaderboard. Please try again.'
      );
    });

    it('should log out on a dead session with the loading flag already cleared', async () => {
      const logoutSpy = vi.fn();
      const authStore = await import('@/stores/authStore');
      const spy = vi
        .spyOn(authStore.useAuthStore.getState(), 'logout')
        .mockImplementation(logoutSpy);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthenticated.' }),
      });

      await useRankedStore.getState().fetchLeaderboard();

      expect(logoutSpy).toHaveBeenCalled();
      // 4.4 review lesson: assert the POST-state — the flag must be false
      // even if logout stops resetting the ranked store
      expect(useRankedStore.getState().isLoadingLeaderboard).toBe(false);

      spy.mockRestore();
      expect(authStore.useAuthStore.getState().logout).not.toBe(logoutSpy);
    });

    it('should drop a stale response superseded by a newer fetch', async () => {
      let resolveFirst: (value: unknown) => void = () => {};
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [makeLeaderboardEntry({ rank: 1, id: 'entry-new' })],
      });

      const first = useRankedStore.getState().fetchLeaderboard();
      const second = useRankedStore.getState().fetchLeaderboard();
      await second;

      // The stale first response lands after the second settled
      resolveFirst({
        ok: true,
        status: 200,
        json: async () => [makeLeaderboardEntry({ rank: 1, id: 'entry-stale' })],
      });
      await first;

      expect(useRankedStore.getState().leaderboardEntries.map((entry) => entry.id)).toEqual([
        'entry-new',
      ]);
    });

    it('should clear the leaderboard slice on reset', () => {
      useRankedStore.setState({
        leaderboardEntries: [makeLeaderboardEntry()],
        isLoadingLeaderboard: true,
        leaderboardError: 'boom',
      });
      useRankedStore.getState().reset();

      expect(useRankedStore.getState().leaderboardEntries).toEqual([]);
      expect(useRankedStore.getState().isLoadingLeaderboard).toBe(false);
      expect(useRankedStore.getState().leaderboardError).toBeNull();
    });
  });

  it('should clear the history slice on reset (story 4.4)', () => {
    useRankedStore.setState({
      historyMatches: [makeMatch() as never],
      historyPage: 2,
      historyLastPage: 5,
      historyTacticId: 'tactic-1',
      isLoadingHistory: true,
      historyError: 'boom',
    });
    useRankedStore.getState().reset();

    expect(useRankedStore.getState().historyMatches).toEqual([]);
    expect(useRankedStore.getState().historyPage).toBe(1);
    expect(useRankedStore.getState().historyLastPage).toBe(1);
    expect(useRankedStore.getState().historyTacticId).toBeNull();
    expect(useRankedStore.getState().isLoadingHistory).toBe(false);
    expect(useRankedStore.getState().historyError).toBeNull();
  });

  it('should expose ApiError shape compatibility (regression guard)', () => {
    const error = new ApiError(404, 'No opponents ready');
    expect(error.status).toBe(404);
    expect(error.message).toBe('No opponents ready');
  });
});
