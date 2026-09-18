/**
 * Matchmaking Store - Ranked queue state (story 4.1)
 * OWNER: Dev Team
 */

import { create } from 'zustand';
import { apiFetch, ApiError, getApiError } from '@/lib/apiClient';
import type { MatchResult, QueueStatusResponse } from '@/types';

/** Client-visible phases; 'joining'/'error' are UI states the API never returns */
export type MatchmakingPhase = 'idle' | 'joining' | 'waiting' | 'matched' | 'timeout' | 'error';

interface MatchmakingState {
  queueStatus: MatchmakingPhase;

  // The ranked match created when the user was paired (null otherwise)
  match: MatchResult | null;

  // Error message from the last failed join (null otherwise)
  error: string | null;
}

interface MatchmakingActions {
  /**
   * Joins the ranked queue with the given tactic (AC #1). Idempotent on the
   * server; a double call while joining/waiting is a local no-op. When an
   * opponent was already waiting the response carries the created match
   * (AC #2) — the queue never simulates it (story 4.2).
   */
  joinQueue: (tacticId: string) => Promise<void>;

  /**
   * One poll of GET /api/matchmaking/queue (AC #2, #3). The COMPONENT owns
   * the 2s interval; each poll carries a sequence token so a response from
   * a cancelled/superseded poll can never write state (matchStore
   * replayLoadSeq precedent). 'timeout' and an unexpected 'idle' both end
   * the wait (AC #3); transient network hiccups keep the wait alive — the
   * next poll retries.
   */
  pollStatus: () => Promise<void>;

  /**
   * One-shot status check that can re-enter the matching phase (mount
   * reconciliation): a page reload while the server still holds a
   * 'waiting' row resumes the banner + polling (AC #2/#3), and an already
   * 'matched' row is surfaced instead of being silently lost. Failures
   * leave the store untouched — the next explicit action takes over.
   */
  reconcile: () => Promise<void>;

  /**
   * Leaves the queue (AC #4). Spec order: the DELETE completes first, then
   * the UI goes idle — a join POST still in flight is awaited first so its
   * server-side upsert cannot land after the DELETE and leave a pairable
   * 'waiting' row behind the user's back. A lost DELETE returns to
   * 'waiting' and resumes polling so the real outcome (pairing or the 30s
   * expiry) is observed. A dead session (401) logs out so the auth gate
   * takes over.
   */
  cancelQueue: () => Promise<void>;

  /**
   * Clears a terminal banner (matched/timeout/error) back to idle. The
   * server-side row is untouched — only an explicit Cancel or the 30s
   * expiry changes it; dismissing a 'matched' banner discards the local
   * match reference (the row itself lives in the matches table for 4.2+).
   */
  dismiss: () => void;

  // Reset to initial state (logout cleanup)
  reset: () => void;
}

const initialState: MatchmakingState = {
  queueStatus: 'idle',
  match: null,
  error: null,
};

const QUEUE_FALLBACK_MESSAGE = 'Could not join the queue. Please try again.';
const MATCH_PAYLOAD_FALLBACK_MESSAGE = 'Match found, but its details failed to load. Please try again.';

// In-flight poll/join token. Any phase change (cancel, reset, a new join)
// invalidates polls AND joins that are still awaiting a response.
let pollSeq = 0;

// The join POST currently in flight. cancelQueue awaits it before sending
// the DELETE: a late join response must not re-create a 'waiting' row after
// the cancel (the response write is separately guarded by the seq token).
let inFlightJoin: Promise<void> | null = null;

const handleDeadSession = async (): Promise<void> => {
  // Dynamic import: authStore already imports this store for its logout
  // cleanup — a static one would close a cycle (matchStore precedent).
  const { useAuthStore } = await import('./authStore');
  useAuthStore.getState().logout();
};

export const useMatchmakingStore = create<MatchmakingState & MatchmakingActions>((set, get) => ({
  ...initialState,

  joinQueue: async (tacticId: string) => {
    const { queueStatus } = get();
    if (queueStatus === 'joining' || queueStatus === 'waiting') {
      return;
    }

    // A new join invalidates polls AND joins from any previous phase.
    const joinSeq = ++pollSeq;
    set({ queueStatus: 'joining', match: null, error: null });

    const join = (async () => {
      try {
        const response = await apiFetch('/matchmaking/queue', {
          method: 'POST',
          body: JSON.stringify({ tactic_id: tacticId }),
        });
        const payload = (await response.json().catch(() => null)) as QueueStatusResponse | null;

        // Cancelled, reset or superseded while in flight: the newer state
        // owns the store.
        if (joinSeq !== pollSeq || get().queueStatus !== 'joining') return;

        if (payload?.status === 'matched') {
          if (payload.match) {
            set({ queueStatus: 'matched', match: payload.match });
          } else {
            // Contract drift: a matched verdict without the match payload
            // must not strand the UI in a non-terminal state.
            set({ queueStatus: 'error', error: MATCH_PAYLOAD_FALLBACK_MESSAGE });
          }
        } else if (payload?.status === 'waiting') {
          set({ queueStatus: 'waiting' });
        } else {
          set({ queueStatus: 'error', error: QUEUE_FALLBACK_MESSAGE });
        }
      } catch (error) {
        if (joinSeq !== pollSeq || get().queueStatus !== 'joining') return;

        if (error instanceof ApiError && error.status === 401) {
          // Dead session: a retry can never succeed — log out so the auth
          // gate takes over (matchStore precedent). logout() resets this
          // store; do not write past it (the poll path already returns).
          await handleDeadSession();
          return;
        }

        // 422 (incomplete lineup) surfaces the server's message; anything
        // non-HTTP gets the human fallback instead of browser jargon.
        const message = error instanceof ApiError ? getApiError(error) : '';

        set({ queueStatus: 'error', error: message || QUEUE_FALLBACK_MESSAGE });
      }
    })();

    inFlightJoin = join;
    try {
      await join;
    } finally {
      if (inFlightJoin === join) inFlightJoin = null;
    }
  },

  pollStatus: async () => {
    if (get().queueStatus !== 'waiting') {
      return;
    }

    const seq = ++pollSeq;

    try {
      const response = await apiFetch('/matchmaking/queue');
      const payload = (await response.json().catch(() => null)) as QueueStatusResponse | null;

      // Superseded, cancelled or left the waiting phase: stay silent.
      if (seq !== pollSeq || get().queueStatus !== 'waiting') return;

      if (payload?.status === 'matched') {
        if (payload.match) {
          set({ queueStatus: 'matched', match: payload.match });
        } else {
          // Contract drift: a matched verdict without the match payload
          // must not keep the client "Searching..." until a false timeout.
          set({ queueStatus: 'error', error: MATCH_PAYLOAD_FALLBACK_MESSAGE });
        }
      } else if (payload?.status === 'timeout') {
        set({ queueStatus: 'timeout' });
      } else if (payload?.status === 'idle') {
        // The server has no entry for us (e.g. its queue was wiped): the
        // wait is definitively over — report the timeout outcome instead of
        // pretending to search forever.
        set({ queueStatus: 'timeout' });
      }
      // 'waiting': keep waiting, the next poll re-checks.
    } catch (error) {
      if (seq !== pollSeq || get().queueStatus !== 'waiting') return;

      if (error instanceof ApiError && error.status === 401) {
        await handleDeadSession();
        return;
      }

      // Transient failure (network blip): keep waiting — the next poll
      // retries, and the server-side 30s expiry bounds the worst case.
    }
  },

  reconcile: async () => {
    const seq = ++pollSeq;

    try {
      const response = await apiFetch('/matchmaking/queue');
      const payload = (await response.json().catch(() => null)) as QueueStatusResponse | null;

      // Superseded by a join/cancel started since: they own the store.
      if (seq !== pollSeq) return;

      if (payload?.status === 'matched') {
        if (payload.match) {
          set({ queueStatus: 'matched', match: payload.match });
        } else {
          set({ queueStatus: 'error', error: MATCH_PAYLOAD_FALLBACK_MESSAGE });
        }
      } else if (payload?.status === 'waiting') {
        set({ queueStatus: 'waiting' });
      } else if (payload?.status === 'timeout') {
        set({ queueStatus: 'timeout' });
      }
      // 'idle': nothing pending server-side — keep the current phase.
    } catch {
      // Offline/dead session on mount: leave the store untouched — the
      // auth gate and the next explicit action take over.
    }
  },

  cancelQueue: async () => {
    const { queueStatus } = get();
    if (queueStatus !== 'waiting' && queueStatus !== 'joining') {
      return;
    }

    // A join POST still in flight must complete BEFORE the DELETE: its
    // server-side upsert would otherwise land after the cancel and leave
    // a pairable 'waiting' row behind the user's back.
    if (inFlightJoin) {
      await inFlightJoin.catch(() => {});
    }

    // Invalidate in-flight polls (and any join started meanwhile) before
    // leaving the phase.
    pollSeq++;

    try {
      // Spec order (Task 6): DELETE first, idle only once it succeeded.
      await apiFetch('/matchmaking/queue', { method: 'DELETE' });
      set({ queueStatus: 'idle', match: null, error: null });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleDeadSession();
        return;
      }
      // Lost DELETE: the row may still pair for up to 30s — go back to
      // waiting and let polling observe the real outcome (pairing or the
      // server-enforced expiry) instead of showing a lie.
      set({ queueStatus: 'waiting' });
      void get().pollStatus();
    }
  },

  dismiss: () => {
    pollSeq++;
    set({ queueStatus: 'idle', match: null, error: null });
  },

  reset: () => {
    pollSeq++;
    set(initialState);
  },
}));
