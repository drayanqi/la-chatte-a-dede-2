/**
 * Match Store Unit Tests
 *
 * Tests the Zustand store that manages practice match state (stories 3.5
 * and 3.8):
 * - startPracticeMatch POSTs to /api/matches (synchronous, no polling)
 * - isSimulating flag drives the "Simulating..." overlay
 * - Success stores the last match; failure stores the error message
 * - Double-start guard while a simulation is in flight
 * - loadReplay fetches /api/matches/{id}/frames once and keeps the parsed
 *   frames (release-on-success: previous replay stays visible until the
 *   validated new one swaps in, stale responses stay dead)
 * - fetchLatestMatch auto-selects the newest completed match (AC #4)
 *
 * @see Epic 3: Practice Mode & Match Experience
 * @see Story 3.5: Practice Match Trigger (Task 7)
 * @see Story 3.8: Replay Playback System (Task 5)
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMatchStore } from '@/stores/matchStore';
import type { MatchFrame, MatchResult } from '@/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const completedMatch: MatchResult = {
  id: 'match-1',
  mode: 'practice',
  status: 'completed',
  scoreChallenger: 2,
  scoreOpponent: 1,
  result: 'challenger_win',
  durationFrames: 10800,
  createdAt: '2026-09-14T10:00:00Z',
};

const okResponse = (body: unknown): Response =>
  ({
    ok: true,
    json: async () => body,
  }) as unknown as Response;

const frameAt = (index: number): MatchFrame => ({
  index,
  ball: { x: 50, y: 50 },
  players: [
    { team: 'challenger', slot: 1, x: 25, y: 30, state: 'moving' },
    { team: 'opponent', slot: 1, x: 75, y: 30, state: 'idle' },
  ],
  events: [],
  logs: [],
});

/** The raw engine frame file served by GET /api/matches/{id}/frames */
const framesFileResponse = (frames: MatchFrame[]): Response =>
  okResponse({
    match_id: 'match-1',
    seed: 7,
    total_frames: frames.length,
    result: { score_challenger: 1, score_opponent: 0, winner: 'challenger' },
    frames,
  });

const pendingResponse = (): { promise: Promise<Response>; resolve: (value: Response) => void } => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  mockFetch.mockImplementationOnce(() => promise);
  return { promise, resolve };
};

describe('Match Store', () => {
  beforeEach(() => {
    useMatchStore.getState().reset();
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
    it('should not be simulating, with no result and no error', () => {
      const state = useMatchStore.getState();

      expect(state.isSimulating).toBe(false);
      expect(state.lastMatch).toBeNull();
      expect(state.matchError).toBeNull();
    });

    it('should start with an empty replay state (story 3.8)', () => {
      const state = useMatchStore.getState();

      expect(state.replayFrames).toEqual([]);
      expect(state.replayMatch).toBeNull();
      expect(state.isReplayLoading).toBe(false);
      expect(state.replayError).toBeNull();
      expect(state.latestMatch).toBeNull();
    });
  });

  describe('Start Practice Match', () => {
    it('should POST the practice payload and store the result', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(completedMatch));

      const promise = useMatchStore.getState().startPracticeMatch('tactic-1');

      // In-flight state is observable immediately (drives the overlay)
      expect(useMatchStore.getState().isSimulating).toBe(true);

      await promise;

      const state = useMatchStore.getState();
      expect(state.isSimulating).toBe(false);
      expect(state.lastMatch).toEqual(completedMatch);
      expect(state.matchError).toBeNull();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/matches',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ mode: 'practice', tactic_id: 'tactic-1', bot: 'easy' }),
        })
      );
    });

    it('should refresh latestMatch when the new match is completed (AC #4)', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(completedMatch));

      await useMatchStore.getState().startPracticeMatch('tactic-1');

      // Within a session: a freshly completed match becomes the "watch
      // last match" target immediately — no stale chip until next mount
      expect(useMatchStore.getState().latestMatch?.id).toBe('match-1');
    });

    it('should store the error and drop any result when the request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ message: 'Simulation failed' }),
      } as unknown as Response);

      await useMatchStore.getState().startPracticeMatch('tactic-1');

      const state = useMatchStore.getState();
      expect(state.isSimulating).toBe(false);
      expect(state.lastMatch).toBeNull();
      expect(state.matchError).toBe('Simulation failed');
    });

    it('should fall back to a generic message when the error has no message', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await useMatchStore.getState().startPracticeMatch('tactic-1');

      // Non-HTTP failures must surface the human fallback, not the raw
      // browser error message (AC #4: actionable error message).
      expect(useMatchStore.getState().matchError).toBe('Simulation failed. Please try again.');
    });

    it('should clear a previous result and error when starting a new match', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(completedMatch));
      await useMatchStore.getState().startPracticeMatch('tactic-1');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ message: 'Simulation failed' }),
      } as unknown as Response);
      await useMatchStore.getState().startPracticeMatch('tactic-2');

      mockFetch.mockResolvedValueOnce(okResponse({ ...completedMatch, id: 'match-2' }));
      await useMatchStore.getState().startPracticeMatch('tactic-2');

      const state = useMatchStore.getState();
      expect(state.lastMatch?.id).toBe('match-2');
      expect(state.matchError).toBeNull();
    });

    it('should ignore a double start while a simulation is in flight', async () => {
      let resolveFirst: (value: Response) => void = () => {};
      mockFetch.mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          })
      );

      const first = useMatchStore.getState().startPracticeMatch('tactic-1');
      await useMatchStore.getState().startPracticeMatch('tactic-1');

      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveFirst(okResponse(completedMatch));
      await first;

      expect(useMatchStore.getState().lastMatch).toEqual(completedMatch);
    });
  });

  describe('Replay Loading (story 3.8)', () => {
    it('should fetch the frames endpoint once and store the parsed frames', async () => {
      const frames = [frameAt(0), frameAt(1)];
      mockFetch.mockResolvedValueOnce(framesFileResponse(frames));

      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/matches/match-1/frames',
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: 'application/json' }),
        })
      );

      const state = useMatchStore.getState();
      expect(state.isReplayLoading).toBe(false);
      expect(state.replayFrames).toEqual(frames);
      expect(state.replayFrames).toBe(frames); // parsed once, kept by reference
      expect(state.replayMatch).toEqual(completedMatch);
      expect(state.replayError).toBeNull();
    });

    it('should expose the loading state while the frames are in flight', async () => {
      const { resolve } = pendingResponse();

      const promise = useMatchStore.getState().loadReplay('match-1', completedMatch);
      expect(useMatchStore.getState().isReplayLoading).toBe(true);

      resolve(framesFileResponse([frameAt(0)]));
      await promise;

      expect(useMatchStore.getState().isReplayLoading).toBe(false);
    });

    it('should ignore a second load while one is in flight', async () => {
      const { resolve } = pendingResponse();

      const first = useMatchStore.getState().loadReplay('match-1', completedMatch);
      await useMatchStore.getState().loadReplay('match-2');

      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolve(framesFileResponse([frameAt(0)]));
      await first;

      const state = useMatchStore.getState();
      expect(state.isReplayLoading).toBe(false);
      expect(state.replayMatch?.id).toBe('match-1');
    });

    it('should surface the unavailable message when the match has no frames (404)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Match frames not found' }),
      } as unknown as Response);

      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      const state = useMatchStore.getState();
      expect(state.isReplayLoading).toBe(false);
      expect(state.replayFrames).toEqual([]);
      expect(state.replayError).toBe('Replay unavailable. This match cannot be watched.');
    });

    it('should fall back to a friendly message when the request fails without an HTTP error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      expect(useMatchStore.getState().replayError).toBe('Replay unavailable. Please try again.');
    });

    it('should reject a malformed frames payload with the unavailable message', async () => {
      // A payload without a frames array cannot be played
      mockFetch.mockResolvedValueOnce(okResponse({ total_frames: 2 }));

      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      expect(useMatchStore.getState().replayError).toBe(
        'Replay unavailable. This match cannot be watched.'
      );
    });

    it('should keep the previous replay visible until the new one validates, then swap it in', async () => {
      const first = [frameAt(0)];
      mockFetch.mockResolvedValueOnce(framesFileResponse(first));
      await useMatchStore.getState().loadReplay('match-1', completedMatch);
      expect(useMatchStore.getState().replayFrames).toHaveLength(1);

      const { resolve } = pendingResponse();
      const promise = useMatchStore.getState().loadReplay('match-2', {
        ...completedMatch,
        id: 'match-2',
      });

      // Release-on-success (review decision 2a): the previous replay stays
      // on screen (exit control mounted) while the new one downloads
      expect(useMatchStore.getState().replayFrames).toBe(first);

      const second = [frameAt(0), frameAt(1)];
      resolve(framesFileResponse(second));
      await promise;

      // Atomic swap: the old array is dropped only now, replaced by reference
      const state = useMatchStore.getState();
      expect(state.replayFrames).toBe(second);
      expect(state.replayFrames).not.toBe(first);
      expect(state.replayMatch?.id).toBe('match-2');
    });

    it('should keep the previous replay when the new load fails', async () => {
      const first = [frameAt(0)];
      mockFetch.mockResolvedValueOnce(framesFileResponse(first));
      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Match frames not found' }),
      } as unknown as Response);

      await useMatchStore.getState().loadReplay('match-2', { ...completedMatch, id: 'match-2' });

      // A failed reload must not blank the replay the user is watching —
      // isReplayMode (frames > 0) and the back-to-editor control survive
      const state = useMatchStore.getState();
      expect(state.replayFrames).toBe(first);
      expect(state.replayError).toBe('Replay unavailable. This match cannot be watched.');
      expect(state.isReplayLoading).toBe(false);
    });

    it('must not resurrect replay state when clearReplay runs mid-flight', async () => {
      const { resolve } = pendingResponse();

      const promise = useMatchStore.getState().loadReplay('match-1', completedMatch);
      expect(useMatchStore.getState().isReplayLoading).toBe(true);

      // The user leaves replay mode while the ~5-8MB download runs
      useMatchStore.getState().clearReplay();

      resolve(framesFileResponse([frameAt(0)]));
      await promise;

      // The late response must stay dead: no frames, no loading, no match
      const state = useMatchStore.getState();
      expect(state.replayFrames).toEqual([]);
      expect(state.replayMatch).toBeNull();
      expect(state.isReplayLoading).toBe(false);
      expect(state.replayError).toBeNull();
    });

    it('should cancel an in-flight load and allow a new one to start', async () => {
      const { resolve } = pendingResponse();

      const promise = useMatchStore.getState().loadReplay('match-1', completedMatch);
      expect(useMatchStore.getState().isReplayLoading).toBe(true);

      useMatchStore.getState().cancelReplayLoad();
      expect(useMatchStore.getState().isReplayLoading).toBe(false);

      // The aborted request settles afterwards — it must stay silent
      resolve(framesFileResponse([frameAt(0)]));
      await promise;

      const state = useMatchStore.getState();
      expect(state.replayFrames).toEqual([]);
      expect(state.replayError).toBeNull();

      // A new load can start immediately (the ignore-guard is cleared)
      mockFetch.mockResolvedValueOnce(framesFileResponse([frameAt(0), frameAt(1)]));
      await useMatchStore.getState().loadReplay('match-1', completedMatch);
      expect(useMatchStore.getState().replayFrames).toHaveLength(2);
    });

    it('should reject an empty frames payload with the unavailable message', async () => {
      // A "successful" load with nothing to play would be a silent dead click
      mockFetch.mockResolvedValueOnce(framesFileResponse([]));

      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      expect(useMatchStore.getState().replayError).toBe(
        'Replay unavailable. This match cannot be watched.'
      );
      expect(useMatchStore.getState().isReplayLoading).toBe(false);
    });

    it('should treat a 401 as a dead session instead of offering a retry', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthenticated.' }),
      } as unknown as Response);

      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      // authStore precedent: the stale token goes, the auth gate takes over
      expect(useMatchStore.getState().isReplayLoading).toBe(false);
      expect(useMatchStore.getState().replayError).toBe('Replay unavailable. Please try again.');
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });

    it('should resolve the owning match from the known matches when not provided', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(completedMatch));
      await useMatchStore.getState().startPracticeMatch('tactic-1');

      mockFetch.mockResolvedValueOnce(framesFileResponse([frameAt(0)]));
      await useMatchStore.getState().loadReplay('match-1');

      expect(useMatchStore.getState().replayMatch).toEqual(completedMatch);
    });

    it('should keep a null owning match when the id is unknown', async () => {
      mockFetch.mockResolvedValueOnce(framesFileResponse([frameAt(0)]));

      await useMatchStore.getState().loadReplay('match-unknown');

      const state = useMatchStore.getState();
      expect(state.replayMatch).toBeNull();
      expect(state.replayFrames).toHaveLength(1); // frames still usable
    });
  });

  describe('Fetch Latest Match (story 3.8 AC #4)', () => {
    it('should select the first completed match (list is newest first)', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          data: [
            { ...completedMatch, id: 'pending-match', status: 'pending', result: null },
            { ...completedMatch, id: 'newest', createdAt: '2026-09-15T10:00:00Z' },
            { ...completedMatch, id: 'older', createdAt: '2026-09-13T10:00:00Z' },
          ],
        })
      );

      await useMatchStore.getState().fetchLatestMatch();

      expect(useMatchStore.getState().latestMatch?.id).toBe('newest');
    });

    it('should keep latestMatch null when no completed match exists', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({ data: [{ ...completedMatch, status: 'failed', result: null }] })
      );

      await useMatchStore.getState().fetchLatestMatch();

      expect(useMatchStore.getState().latestMatch).toBeNull();
    });

    it('should keep latestMatch null when the request fails', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await useMatchStore.getState().fetchLatestMatch();

      // The "watch last match" entry is a convenience — a failed fetch
      // simply keeps it hidden, no error surface
      expect(useMatchStore.getState().latestMatch).toBeNull();
    });

    it('should keep a previously known latestMatch when a refetch fails', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ data: [completedMatch] }));
      await useMatchStore.getState().fetchLatestMatch();
      expect(useMatchStore.getState().latestMatch?.id).toBe('match-1');

      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await useMatchStore.getState().fetchLatestMatch();

      // A transient failure must not hide a working "watch last match" entry
      expect(useMatchStore.getState().latestMatch?.id).toBe('match-1');
    });
  });

  describe('Clear Replay (story 3.8)', () => {
    it('should drop the replay state but keep the match history', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ data: [completedMatch] }));
      await useMatchStore.getState().fetchLatestMatch();

      mockFetch.mockResolvedValueOnce(framesFileResponse([frameAt(0)]));
      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      useMatchStore.getState().clearReplay();

      const state = useMatchStore.getState();
      expect(state.replayFrames).toEqual([]);
      expect(state.replayMatch).toBeNull();
      expect(state.replayError).toBeNull();
      expect(state.isReplayLoading).toBe(false);
      expect(state.latestMatch).toEqual(completedMatch); // the entry survives
      expect(state.lastMatch).toBeNull(); // untouched by the replay flow
    });
  });

  describe('Replay Logs (story 3.10)', () => {
    /** A frame carrying per-tick logs (3.4 contract consumed by the panel) */
    const frameWithLogs = (index: number): MatchFrame => ({
      ...frameAt(index),
      logs: [
        { team: 'challenger', slot: 1, level: 'log', type: 'CONSOLE', message: 'pos 42.5' },
        {
          team: 'challenger',
          slot: 1,
          level: 'warn',
          type: 'MULTIPLE_ACTIONS',
          message: 'only the first action per tick is applied',
        },
      ],
    });

    it('should extract the frame logs once per replay load', async () => {
      const frames = [frameWithLogs(0), frameWithLogs(1)];
      mockFetch.mockResolvedValueOnce(framesFileResponse(frames));

      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      const logs = useMatchStore.getState().replayLogs;
      expect(logs).toHaveLength(4);
      expect(logs[0]).toMatchObject({
        index: 0,
        tick: 0,
        level: 'log',
        type: 'CONSOLE',
        message: 'pos 42.5',
      });
      expect(logs[2]).toMatchObject({ index: 2, tick: 1, level: 'log' });
      expect(logs[3]).toMatchObject({ index: 3, tick: 1, level: 'warn' });
    });

    it('should keep an empty log set for replays without frame logs', async () => {
      mockFetch.mockResolvedValueOnce(framesFileResponse([frameAt(0)]));

      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      expect(useMatchStore.getState().replayLogs).toEqual([]);
    });

    it('should clear the extracted logs with the replay', async () => {
      mockFetch.mockResolvedValueOnce(framesFileResponse([frameWithLogs(0)]));
      await useMatchStore.getState().loadReplay('match-1', completedMatch);
      expect(useMatchStore.getState().replayLogs).toHaveLength(2);

      useMatchStore.getState().clearReplay();

      expect(useMatchStore.getState().replayLogs).toEqual([]);
    });
  });

  describe('Reset', () => {
    it('should clear every match state field', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ data: [completedMatch] }));
      await useMatchStore.getState().fetchLatestMatch();

      mockFetch.mockResolvedValueOnce(framesFileResponse([frameAt(0)]));
      await useMatchStore.getState().loadReplay('match-1', completedMatch);

      useMatchStore.getState().reset();

      const state = useMatchStore.getState();
      expect(state.isSimulating).toBe(false);
      expect(state.lastMatch).toBeNull();
      expect(state.matchError).toBeNull();
      expect(state.replayFrames).toEqual([]);
      expect(state.replayMatch).toBeNull();
      expect(state.isReplayLoading).toBe(false);
      expect(state.replayError).toBeNull();
      expect(state.latestMatch).toBeNull();
    });
  });
});
