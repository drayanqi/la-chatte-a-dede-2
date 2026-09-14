/**
 * Match Store - Practice match simulation state
 * OWNER: Dev Team
 */

import { create } from 'zustand';
import { apiFetch, ApiError, getApiError } from '@/lib/apiClient';
import type { MatchResult } from '@/types';

interface MatchState {
  // True while the synchronous simulation request is in flight
  isSimulating: boolean;

  // The most recently simulated match (null until the first success)
  lastMatch: MatchResult | null;

  // Error message from the last failed attempt (null when the last run succeeded)
  matchError: string | null;
}

interface MatchActions {
  /**
   * Starts a practice match against the Easy Bot (story 3.5). The request is
   * synchronous (AC #3: zero queue time): it resolves only once the engine
   * finished simulating. A double-start while in flight is ignored — the
   * running simulation cannot be cancelled.
   */
  startPracticeMatch: (tacticId: string) => Promise<void>;

  // Reset to initial state (logout / navigation cleanup)
  reset: () => void;
}

const initialState: MatchState = {
  isSimulating: false,
  lastMatch: null,
  matchError: null,
};

export const useMatchStore = create<MatchState & MatchActions>((set, get) => ({
  ...initialState,

  startPracticeMatch: async (tacticId: string) => {
    // Block double-start: the button is disabled and covered by the overlay,
    // but a programmatic double call must also be a no-op.
    if (get().isSimulating) {
      return;
    }

    set({ isSimulating: true, lastMatch: null, matchError: null });

    try {
      const response = await apiFetch('/matches', {
        method: 'POST',
        body: JSON.stringify({ mode: 'practice', tactic_id: tacticId, bot: 'easy' }),
      });

      const match = (await response.json()) as MatchResult;

      set({ isSimulating: false, lastMatch: match, matchError: null });
    } catch (error) {
      // Non-HTTP failures (network down, request aborted) surface as raw
      // browser messages like "Failed to fetch" — show the human fallback
      // instead of browser jargon (AC #4: an actionable error message).
      const message = error instanceof ApiError ? getApiError(error) : '';

      set({
        isSimulating: false,
        lastMatch: null,
        matchError: message || 'Simulation failed. Please try again.',
      });
    }
  },

  reset: () => set(initialState),
}));
