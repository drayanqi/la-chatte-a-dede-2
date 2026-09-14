/**
 * Match Store Unit Tests
 *
 * Tests the Zustand store that manages practice match state (story 3.5):
 * - startPracticeMatch POSTs to /api/matches (synchronous, no polling)
 * - isSimulating flag drives the "Simulating..." overlay
 * - Success stores the last match; failure stores the error message
 * - Double-start guard while a simulation is in flight
 *
 * @see Epic 3: Practice Mode & Match Experience
 * @see Story 3.5: Practice Match Trigger (Task 7)
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMatchStore } from '@/stores/matchStore';
import type { MatchResult } from '@/types';

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

  describe('Reset', () => {
    it('should clear every match state field', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(completedMatch));
      await useMatchStore.getState().startPracticeMatch('tactic-1');

      useMatchStore.getState().reset();

      const state = useMatchStore.getState();
      expect(state.isSimulating).toBe(false);
      expect(state.lastMatch).toBeNull();
      expect(state.matchError).toBeNull();
    });
  });
});
