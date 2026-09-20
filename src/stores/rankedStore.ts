/**
 * Ranked Store - Ready-fighter matchmaking (Epic 4 v2, story 4.3)
 * OWNER: Dev Team
 */

import { create } from 'zustand';
import { apiFetch, ApiError, getApiError } from '@/lib/apiClient';
import type { MatchResult, RankedOpponent } from '@/types';

interface RankedState {
  // The challengeable pool (ready tactics of other players, elo desc)
  opponents: RankedOpponent[];
  isLoadingOpponents: boolean;
  opponentsError: string | null;
  hasLoadedOpponents: boolean;

  // Play flow: the tactic I fielded, the opponent I challenged (null for
  // quick matches), the completed match and its failure surface
  activeTacticId: string | null;
  opponentTacticId: string | null;
  match: MatchResult | null;
  isPlaying: boolean;
  matchError: string | null;
}

interface RankedActions {
  /** Refreshes the opponents pool (on view open and after each match) */
  fetchOpponents: () => Promise<void>;

  /** Quick match: a random ready opponent, any elo (AC #1) */
  quickMatch: (tacticId: string) => Promise<void>;

  /** Challenge: one specific opponent tactic from the pool (AC #2) */
  challenge: (tacticId: string, opponentTacticId: string) => Promise<void>;

  /** Clears the result banner (the pool refresh is the caller's next fetch) */
  clearResult: () => void;

  // Reset to initial state (logout cleanup)
  reset: () => void;
}

const initialState: RankedState = {
  opponents: [],
  isLoadingOpponents: false,
  opponentsError: null,
  hasLoadedOpponents: false,
  activeTacticId: null,
  opponentTacticId: null,
  match: null,
  isPlaying: false,
  matchError: null,
};

const OPPONENTS_FALLBACK_MESSAGE = 'Could not load opponents. Please try again.';
const MATCH_FALLBACK_MESSAGE = 'Could not start the match. Please try again.';

// In-flight play token: a settled or superseded response can never write
// state after a newer action (matchStore replayLoadSeq precedent)
let playSeq = 0;

const handleDeadSession = async (): Promise<void> => {
  // Dynamic import: authStore already imports this store's reset — a
  // static one would close a cycle (matchmakingStore precedent)
  const { useAuthStore } = await import('./authStore');
  useAuthStore.getState().logout();
};

export const useRankedStore = create<RankedState & RankedActions>((set, get) => ({
  ...initialState,

  fetchOpponents: async () => {
    set({ isLoadingOpponents: true, opponentsError: null });

    try {
      const response = await apiFetch('/matchmaking/opponents');
      const opponents = (await response.json()) as RankedOpponent[];

      set({ opponents, isLoadingOpponents: false, hasLoadedOpponents: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleDeadSession();
        return;
      }

      const message = error instanceof ApiError ? getApiError(error) : '';
      set({
        opponentsError: message || OPPONENTS_FALLBACK_MESSAGE,
        isLoadingOpponents: false,
        hasLoadedOpponents: true,
      });
    }
  },

  quickMatch: async (tacticId: string) => {
    const seq = ++playSeq;

    set({
      isPlaying: true,
      match: null,
      matchError: null,
      activeTacticId: tacticId,
      opponentTacticId: null,
    });

    try {
      const response = await apiFetch('/matchmaking/quick', {
        method: 'POST',
        body: JSON.stringify({ tactic_id: tacticId }),
      });
      const match = (await response.json()) as MatchResult;

      if (seq !== playSeq) return;

      set({ match, isPlaying: false });
      void get().fetchOpponents();
      const { useTacticsStore } = await import('./tacticsStore');
      void useTacticsStore.getState().fetchTactics();
    } catch (error) {
      if (seq !== playSeq) return;

      if (error instanceof ApiError && error.status === 401) {
        await handleDeadSession();
        return;
      }

      const message = error instanceof ApiError ? getApiError(error) : '';
      set({ isPlaying: false, matchError: message || MATCH_FALLBACK_MESSAGE });
    }
  },

  challenge: async (tacticId: string, opponentTacticId: string) => {
    const seq = ++playSeq;

    set({
      isPlaying: true,
      match: null,
      matchError: null,
      activeTacticId: tacticId,
      opponentTacticId,
    });

    try {
      const response = await apiFetch('/matchmaking/challenge', {
        method: 'POST',
        body: JSON.stringify({ tactic_id: tacticId, opponent_tactic_id: opponentTacticId }),
      });
      const match = (await response.json()) as MatchResult;

      if (seq !== playSeq) return;

      set({ match, isPlaying: false });
      void get().fetchOpponents();
      const { useTacticsStore } = await import('./tacticsStore');
      void useTacticsStore.getState().fetchTactics();
    } catch (error) {
      if (seq !== playSeq) return;

      if (error instanceof ApiError && error.status === 401) {
        await handleDeadSession();
        return;
      }

      const message = error instanceof ApiError ? getApiError(error) : '';
      set({ isPlaying: false, matchError: message || MATCH_FALLBACK_MESSAGE });
    }
  },

  clearResult: () => {
    playSeq++;
    set({ match: null, matchError: null, isPlaying: false, activeTacticId: null, opponentTacticId: null });
  },

  reset: () => {
    playSeq++;
    set(initialState);
  },
}));
