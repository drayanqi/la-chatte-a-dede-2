/**
 * Ranked Store - Ready-fighter matchmaking (Epic 4 v2, story 4.3)
 * OWNER: Dev Team
 */

import { create } from 'zustand';
import { apiFetch, ApiError, getApiError } from '@/lib/apiClient';
import type { LeaderboardEntry, MatchResult, RankedOpponent } from '@/types';

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

  // Match history (story 4.4): my ranked matches, both sides, paginated
  historyMatches: MatchResult[];
  isLoadingHistory: boolean;
  isLoadingMoreHistory: boolean;
  historyError: string | null;
  historyPage: number;
  historyLastPage: number;
  historyTacticId: string | null;

  // Public leaderboard (story 4.5): every non-system tactic, server-ranked
  leaderboardEntries: LeaderboardEntry[];
  isLoadingLeaderboard: boolean;
  leaderboardError: string | null;
}

interface RankedActions {
  /** Refreshes the opponents pool (on view open and after each match) */
  fetchOpponents: () => Promise<void>;

  /** Quick match: a random ready opponent, any elo (AC #1) */
  quickMatch: (tacticId: string) => Promise<void>;

  /** Challenge: one specific opponent tactic from the pool (AC #2) */
  challenge: (tacticId: string, opponentTacticId: string) => Promise<void>;

  /** Ranked history page 1, optionally filtered to one of my tactics (AC #2) */
  fetchHistory: (tacticId?: string | null) => Promise<void>;

  /** History: append the next page (one "Load more" pagination) */
  loadMoreHistory: () => Promise<void>;

  /** Refreshes the public leaderboard (on view open, every time) */
  fetchLeaderboard: () => Promise<void>;

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
  historyMatches: [],
  isLoadingHistory: false,
  isLoadingMoreHistory: false,
  historyError: null,
  historyPage: 1,
  historyLastPage: 1,
  historyTacticId: null,
  leaderboardEntries: [],
  isLoadingLeaderboard: false,
  leaderboardError: null,
};

const OPPONENTS_FALLBACK_MESSAGE = 'Could not load opponents. Please try again.';
const MATCH_FALLBACK_MESSAGE = 'Could not start the match. Please try again.';
const HISTORY_FALLBACK_MESSAGE = 'Could not load match history. Please try again.';
const LEADERBOARD_FALLBACK_MESSAGE = 'Could not load the leaderboard. Please try again.';

/** Laravel's flat paginator envelope (fetchLatestMatch precedent) */
interface MatchPagePayload {
  data: MatchResult[];
  current_page: number;
  last_page: number;
}

// In-flight play token: a settled or superseded response can never write
// state after a newer action (matchStore replayLoadSeq precedent)
let playSeq = 0;

// Same philosophy for the history slice: page-1 fetches and appends share one
// token so a newer fetch/filter change always invalidates in-flight writes
let historySeq = 0;

// The leaderboard has one refetch trigger (view open) — but two rapid
// open/close cycles can still overlap: same stale-write guard
let leaderboardSeq = 0;

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

  fetchHistory: async (tacticId) => {
    const seq = ++historySeq;
    const requestedTacticId = tacticId ?? null;

    set({
      isLoadingHistory: true,
      isLoadingMoreHistory: false,
      historyError: null,
      historyTacticId: requestedTacticId,
      // Reset the pagination window up front: after a failed filter change
      // the stale page numbers must not pair with the new filter (or with
      // the previous filter's rows still on screen)
      historyPage: 1,
      historyLastPage: 1,
    });

    try {
      const params = new URLSearchParams({ mode: 'ranked' });
      if (requestedTacticId) params.set('tactic_id', requestedTacticId);

      const response = await apiFetch(`/matches?${params.toString()}`);
      const payload = (await response.json()) as MatchPagePayload;

      if (seq !== historySeq) return;

      set({
        historyMatches: payload.data ?? [],
        historyPage: payload.current_page ?? 1,
        historyLastPage: payload.last_page ?? 1,
        isLoadingHistory: false,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        set({ isLoadingHistory: false, isLoadingMoreHistory: false });
        await handleDeadSession();
        return;
      }

      if (seq !== historySeq) return;

      // A filtered fetch can only 404 when the tactic is gone (deleted or no
      // longer ours): drop the dangling filter and refetch unfiltered
      if (error instanceof ApiError && error.status === 404 && requestedTacticId !== null) {
        void get().fetchHistory(null);
        return;
      }

      const message = error instanceof ApiError ? getApiError(error) : '';
      set({
        historyError: message || HISTORY_FALLBACK_MESSAGE,
        isLoadingHistory: false,
      });
    }
  },

  loadMoreHistory: async () => {
    const { historyPage, historyLastPage, historyTacticId, isLoadingMoreHistory } = get();
    if (isLoadingMoreHistory || historyPage >= historyLastPage) return;

    // Capture the request context BEFORE the await: a page-1 refetch (filter
    // change / view open) or a newer load-more that lands meanwhile must
    // drop this stale append (replayLoadSeq philosophy)
    const seq = ++historySeq;
    const requestedPage = historyPage + 1;
    const requestedTacticId = historyTacticId;

    // A dedicated flag: an append must not unmount the visible rows the way
    // a page-1 load does (the list stays mounted while more arrives)
    set({ isLoadingMoreHistory: true, historyError: null });

    try {
      const params = new URLSearchParams({ mode: 'ranked' });
      if (requestedTacticId) params.set('tactic_id', requestedTacticId);
      params.set('page', String(requestedPage));

      const response = await apiFetch(`/matches?${params.toString()}`);
      const payload = (await response.json()) as MatchPagePayload;

      if (seq !== historySeq) return;

      set({
        historyMatches: [...get().historyMatches, ...(payload.data ?? [])],
        historyPage: payload.current_page ?? requestedPage,
        historyLastPage: payload.last_page ?? get().historyLastPage,
        isLoadingMoreHistory: false,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        set({ isLoadingHistory: false, isLoadingMoreHistory: false });
        await handleDeadSession();
        return;
      }

      if (seq !== historySeq) return;

      // Same dangling-filter rule as fetchHistory
      if (error instanceof ApiError && error.status === 404 && requestedTacticId !== null) {
        void get().fetchHistory(null);
        return;
      }

      const message = error instanceof ApiError ? getApiError(error) : '';
      set({
        historyError: message || HISTORY_FALLBACK_MESSAGE,
        isLoadingMoreHistory: false,
      });
    }
  },

  fetchLeaderboard: async () => {
    const seq = ++leaderboardSeq;

    set({ isLoadingLeaderboard: true, leaderboardError: null });

    try {
      const response = await apiFetch('/leaderboard');
      const entries = (await response.json()) as LeaderboardEntry[];

      if (seq !== leaderboardSeq) return;

      // As-received: the server owns the ranking (rank + order), the client
      // never re-sorts
      set({ leaderboardEntries: entries, isLoadingLeaderboard: false });
    } catch (error) {
      // 401 clears the loading flag BEFORE the logout return (4.4 review
      // finding: the dead-session path must not leave a spinner behind)
      if (error instanceof ApiError && error.status === 401) {
        set({ isLoadingLeaderboard: false });
        await handleDeadSession();
        return;
      }

      if (seq !== leaderboardSeq) return;

      const message = error instanceof ApiError ? getApiError(error) : '';
      set({
        leaderboardError: message || LEADERBOARD_FALLBACK_MESSAGE,
        isLoadingLeaderboard: false,
      });
    }
  },

  reset: () => {
    playSeq++;
    historySeq++;
    leaderboardSeq++;
    set(initialState);
  },
}));
