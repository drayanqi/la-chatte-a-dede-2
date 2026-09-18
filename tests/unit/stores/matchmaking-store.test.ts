/**
 * Matchmaking Store Unit Tests
 *
 * Tests the Zustand store that manages the ranked queue state (story 4.1):
 * - joinQueue POSTs to /api/matchmaking/queue; a waiting opponent returns
 *   the created match immediately (AC #2)
 * - pollStatus resolves waiting → matched and waiting → timeout (AC #2/#3)
 * - An unexpected 'idle' poll ends the wait as a timeout (the entry is gone)
 * - reconcile re-enters the matching phase on mount (reload while queued)
 * - cancelQueue DELETEs first, then goes idle; a lost DELETE returns to
 *   waiting and resumes polling (AC #4)
 * - Double-join guard while joining/waiting; stale poll/join responses
 *   stay dead (sequence tokens)
 * - 422 surfaces the server message; non-HTTP failures get the fallback
 *
 * @see Epic 4: Ranked Competition & Leaderboard
 * @see Story 4.1: Ranked Queue & Matchmaking (Task 8)
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMatchmakingStore } from '@/stores/matchmakingStore';
import { useAuthStore } from '@/stores/authStore';
import type { MatchResult } from '@/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const rankedMatch: MatchResult = {
  id: 'ranked-1',
  mode: 'ranked',
  status: 'pending',
  scoreChallenger: 0,
  scoreOpponent: 0,
  result: null,
  durationFrames: 0,
  createdAt: '2026-09-17T10:00:00Z',
};

const okResponse = (body: unknown): Response =>
  ({
    ok: true,
    json: async () => body,
  }) as unknown as Response;

const errorResponse = (status: number, body: unknown): Response =>
  ({
    ok: false,
    status,
    json: async () => body,
  }) as unknown as Response;

/** A request whose response the test resolves manually */
const pendingResponse = (): { promise: Promise<Response>; resolve: (value: Response) => void } => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  mockFetch.mockImplementationOnce(() => promise);
  return { promise, resolve };
};

describe('Matchmaking Store', () => {
  beforeEach(() => {
    useMatchmakingStore.getState().reset();
    useAuthStore.setState({ user: null, isAuthenticated: false, isRestoring: false });
    vi.clearAllMocks();
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  describe('Initial State', () => {
    it('starts idle with no match and no error', () => {
      const state = useMatchmakingStore.getState();

      expect(state.queueStatus).toBe('idle');
      expect(state.match).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('joinQueue (AC #1, #2)', () => {
    it('enters joining then waiting on a waiting response', async () => {
      mockFetch.mockImplementationOnce(async () => okResponse({ status: 'waiting' }));

      const joining = useMatchmakingStore.getState().joinQueue('tactic-1');
      expect(useMatchmakingStore.getState().queueStatus).toBe('joining');
      await joining;

      expect(useMatchmakingStore.getState().queueStatus).toBe('waiting');
      expect(useMatchmakingStore.getState().error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/matchmaking/queue',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('lands on matched with the created match when an opponent waited', async () => {
      mockFetch.mockImplementationOnce(
        async () => okResponse({ status: 'matched', match: rankedMatch })
      );

      await useMatchmakingStore.getState().joinQueue('tactic-1');

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('matched');
      expect(state.match).toEqual(rankedMatch);
    });

    it('surfaces the server message on a 422 (incomplete lineup)', async () => {
      mockFetch.mockImplementationOnce(
        async () => errorResponse(422, { message: 'Tactic lineup is incomplete' })
      );

      await useMatchmakingStore.getState().joinQueue('tactic-1');

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('error');
      expect(state.error).toBe('Tactic lineup is incomplete');
    });

    it('uses the human fallback on a non-HTTP failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await useMatchmakingStore.getState().joinQueue('tactic-1');

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('error');
      expect(state.error).toBe('Could not join the queue. Please try again.');
    });

    it('ignores a double join while joining or waiting', async () => {
      // Keep the first join in flight; a second call must not fire a request.
      const { promise, resolve } = pendingResponse();

      const first = useMatchmakingStore.getState().joinQueue('tactic-1');
      const second = useMatchmakingStore.getState().joinQueue('tactic-2');
      await second;
      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolve(okResponse({ status: 'waiting' }));
      await first;
      expect(useMatchmakingStore.getState().queueStatus).toBe('waiting');

      // Same while waiting: the second join is a local no-op. No response is
      // staged here — an unconsumed once-implementation would leak (FIFO)
      // into the next test's first fetch.
      await useMatchmakingStore.getState().joinQueue('tactic-1');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('logs out and returns to idle on a dead session (401)', async () => {
      mockFetch.mockImplementationOnce(async () => errorResponse(401, { message: '' }));

      await useMatchmakingStore.getState().joinQueue('tactic-1');

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      // logout() resets this store — the error set must not write past it
      // (a stale error banner would leak into the next session on the tab).
      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('idle');
      expect(state.error).toBeNull();
    });

    it('drops a stale join response superseded by a later join', async () => {
      // Join 1 in flight; a reset (logout cleanup) invalidates it; a second
      // join starts — join 1's late response must never write state.
      const { resolve } = pendingResponse();
      const join1 = useMatchmakingStore.getState().joinQueue('tactic-1');

      useMatchmakingStore.getState().reset();

      mockFetch.mockImplementationOnce(
        async () => okResponse({ status: 'matched', match: rankedMatch })
      );
      const join2 = useMatchmakingStore.getState().joinQueue('tactic-2');

      resolve(okResponse({ status: 'waiting' }));
      await join1;
      await join2;

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('matched');
      expect(state.match).toEqual(rankedMatch);
    });

    it('maps a matched verdict without a match payload to an error (contract drift)', async () => {
      mockFetch.mockImplementationOnce(async () => okResponse({ status: 'matched' }));

      await useMatchmakingStore.getState().joinQueue('tactic-1');

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('error');
      expect(state.error).toBe('Match found, but its details failed to load. Please try again.');
    });
  });

  describe('pollStatus (AC #2, #3)', () => {
    it('transitions waiting → matched and stores the match', async () => {
      useMatchmakingStore.setState({ queueStatus: 'waiting' });
      mockFetch.mockImplementationOnce(
        async () => okResponse({ status: 'matched', match: rankedMatch })
      );

      await useMatchmakingStore.getState().pollStatus();

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('matched');
      expect(state.match).toEqual(rankedMatch);
    });

    it('transitions waiting → timeout on the server-enforced expiry', async () => {
      useMatchmakingStore.setState({ queueStatus: 'waiting' });
      mockFetch.mockImplementationOnce(async () => okResponse({ status: 'timeout' }));

      await useMatchmakingStore.getState().pollStatus();

      expect(useMatchmakingStore.getState().queueStatus).toBe('timeout');
    });

    it('treats an unexpected idle as a timeout (entry gone server-side)', async () => {
      useMatchmakingStore.setState({ queueStatus: 'waiting' });
      mockFetch.mockImplementationOnce(async () => okResponse({ status: 'idle' }));

      await useMatchmakingStore.getState().pollStatus();

      expect(useMatchmakingStore.getState().queueStatus).toBe('timeout');
    });

    it('maps a matched verdict without a match payload to an error (contract drift)', async () => {
      useMatchmakingStore.setState({ queueStatus: 'waiting' });
      mockFetch.mockImplementationOnce(async () => okResponse({ status: 'matched' }));

      await useMatchmakingStore.getState().pollStatus();

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('error');
      expect(state.error).toBe('Match found, but its details failed to load. Please try again.');
    });

    it('keeps waiting through a transient network failure', async () => {
      useMatchmakingStore.setState({ queueStatus: 'waiting' });
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await useMatchmakingStore.getState().pollStatus();

      expect(useMatchmakingStore.getState().queueStatus).toBe('waiting');
    });

    it('is a no-op outside the waiting phase', async () => {
      await useMatchmakingStore.getState().pollStatus();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('drops a stale poll response superseded by a newer poll', async () => {
      useMatchmakingStore.setState({ queueStatus: 'waiting' });

      const first = pendingResponse();
      const firstCall = useMatchmakingStore.getState().pollStatus(); // poll 1 in flight

      const second = pendingResponse();
      const secondCall = useMatchmakingStore.getState().pollStatus(); // poll 2

      // Poll 1 resolves late with a match — it must stay dead: poll 2 owns
      // the store now.
      first.resolve(okResponse({ status: 'matched', match: rankedMatch }));
      await Promise.resolve();
      await Promise.resolve();
      expect(useMatchmakingStore.getState().queueStatus).toBe('waiting');
      expect(useMatchmakingStore.getState().match).toBeNull();

      second.resolve(okResponse({ status: 'matched', match: rankedMatch }));
      await secondCall;
      expect(useMatchmakingStore.getState().queueStatus).toBe('matched');
      await firstCall;
    });

    it('drops an in-flight poll invalidated by a cancel', async () => {
      useMatchmakingStore.setState({ queueStatus: 'waiting' });

      const { resolve } = pendingResponse();
      const poll = useMatchmakingStore.getState().pollStatus();

      mockFetch.mockImplementationOnce(async () => okResponse(undefined));
      await useMatchmakingStore.getState().cancelQueue();
      expect(useMatchmakingStore.getState().queueStatus).toBe('idle');

      resolve(okResponse({ status: 'matched', match: rankedMatch }));
      await poll;

      // The late match must not resurrect state after the cancel.
      expect(useMatchmakingStore.getState().queueStatus).toBe('idle');
      expect(useMatchmakingStore.getState().match).toBeNull();
    });
  });

  describe('reconcile (mount recovery)', () => {
    it('resumes waiting when the server still holds the queued row', async () => {
      mockFetch.mockImplementationOnce(async () => okResponse({ status: 'waiting' }));

      await useMatchmakingStore.getState().reconcile();

      expect(useMatchmakingStore.getState().queueStatus).toBe('waiting');
    });

    it('surfaces a match the user never saw (reload after pairing)', async () => {
      mockFetch.mockImplementationOnce(
        async () => okResponse({ status: 'matched', match: rankedMatch })
      );

      await useMatchmakingStore.getState().reconcile();

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('matched');
      expect(state.match).toEqual(rankedMatch);
    });

    it('keeps idle when nothing is pending server-side', async () => {
      mockFetch.mockImplementationOnce(async () => okResponse({ status: 'idle' }));

      await useMatchmakingStore.getState().reconcile();

      expect(useMatchmakingStore.getState().queueStatus).toBe('idle');
    });

    it('leaves the store untouched on a network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await useMatchmakingStore.getState().reconcile();

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('idle');
      expect(state.error).toBeNull();
    });
  });

  describe('cancelQueue (AC #4)', () => {
    it('DELETEs first and only then goes idle (spec order)', async () => {
      useMatchmakingStore.setState({ queueStatus: 'waiting' });
      mockFetch.mockImplementationOnce(async () => {
        // Still 'waiting' while the DELETE is in flight — the UI must not
        // claim success before the server confirmed the exit.
        expect(useMatchmakingStore.getState().queueStatus).toBe('waiting');
        return okResponse(undefined);
      });

      await useMatchmakingStore.getState().cancelQueue();

      expect(useMatchmakingStore.getState().queueStatus).toBe('idle');
      expect(useMatchmakingStore.getState().match).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/matchmaking/queue',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('returns to waiting and resumes polling when the DELETE fails', async () => {
      useMatchmakingStore.setState({ queueStatus: 'waiting' });
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch')); // DELETE lost
      mockFetch.mockImplementationOnce(async () => okResponse({ status: 'waiting' })); // resume poll

      await useMatchmakingStore.getState().cancelQueue();

      expect(useMatchmakingStore.getState().queueStatus).toBe('waiting');
      // Order matters: the DELETE fires first, the resume poll (GET) after.
      const methods = mockFetch.mock.calls.map(([, init]) => (init as RequestInit).method ?? 'GET');
      expect(methods).toEqual(['DELETE', 'GET']);
    });

    it('is a no-op when idle', async () => {
      await useMatchmakingStore.getState().cancelQueue();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('dismiss', () => {
    it('clears a terminal banner back to idle', () => {
      useMatchmakingStore.setState({
        queueStatus: 'timeout',
        match: null,
        error: 'No opponent found, try again later',
      });

      useMatchmakingStore.getState().dismiss();

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('idle');
      expect(state.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('returns to the initial state', async () => {
      useMatchmakingStore.setState({ queueStatus: 'matched', match: rankedMatch });

      useMatchmakingStore.getState().reset();

      const state = useMatchmakingStore.getState();
      expect(state.queueStatus).toBe('idle');
      expect(state.match).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
