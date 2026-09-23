/**
 * Match Store - Practice match simulation + replay loading state
 * OWNER: Dev Team
 */

import { create } from 'zustand';
import { apiFetch, ApiError, getApiError } from '@/lib/apiClient';
import { extractLogs, type ReplayLogEntry } from '@/lib/replayLogs';
import type { MatchFrame, MatchFramesFile, MatchResult, MatchStats } from '@/types';

interface MatchState {
  // True while the synchronous simulation request is in flight
  isSimulating: boolean;

  // The most recently simulated match (null until the first success)
  lastMatch: MatchResult | null;

  // Error message from the last failed attempt (null when the last run succeeded)
  matchError: string | null;

  // ------------------------------------------------------------------
  // Replay state (story 3.8)
  // ------------------------------------------------------------------

  // The parsed frames of the loaded replay — the single owner of the
  // ~5-8MB array; consumers (canvas, score display) share the reference
  replayFrames: MatchFrame[];

  // The match the loaded replay belongs to (drives the retry affordance)
  replayMatch: MatchResult | null;

  // True while the frames request is in flight (loading overlay)
  isReplayLoading: boolean;

  // Error message from the last failed replay load
  replayError: string | null;

  // The newest completed match (AC #4: "Watch last match" entry)
  latestMatch: MatchResult | null;

  // ------------------------------------------------------------------
  // Debug panel logs (story 3.10)
  // ------------------------------------------------------------------

  // Flat log extraction of the loaded replay, computed ONCE per load
  // (the frame scan must not rerun per render/per playhead move)
  replayLogs: ReplayLogEntry[];

  // ------------------------------------------------------------------
  // Engine telemetry (story 7.9)
  // ------------------------------------------------------------------

  // The loaded replay's stats block. Null for replays without telemetry
  // (older files): the drawer degrades to ghost states, never crashes.
  replayStats: MatchStats | null;
}

interface MatchActions {
  /**
   * Starts a practice match against the Easy Bot (story 3.5). The request is
   * synchronous (AC #3: zero queue time): it resolves only once the engine
   * finished simulating. A double-start while in flight is ignored — the
   * running simulation cannot be cancelled.
   */
  startPracticeMatch: (tacticId: string) => Promise<void>;

  /**
   * Loads the frames of a completed match for playback (story 3.8, AC #1).
   * The ~5-8MB JSON is fetched and parsed in one shot — no streaming/paging
   * for the MVP. The previous replay stays visible and playable while the
   * new one downloads (release-on-success: the old array is dropped in the
   * same atomic set that installs the validated new frames). A double-load
   * while in flight is ignored — cancel it via cancelReplayLoad().
   */
  loadReplay: (matchId: string, match?: MatchResult) => Promise<void>;

  /**
   * Aborts an in-flight replay load (review decision 3c: cancel affordance
   * on the loading overlay) and clears the loading state so a new load can
   * start.
   */
  cancelReplayLoad: () => void;

  /**
   * Fetches the user's matches (newest first) and keeps the first completed
   * one (story 3.8, AC #4). A failure simply hides the "watch last match"
   * entry — no error surface for a convenience affordance.
   */
  fetchLatestMatch: () => Promise<void>;

  /**
   * Drops the loaded replay (frames, owning match, error) when leaving
   * replay mode. The match history (lastMatch, latestMatch) survives.
   */
  clearReplay: () => void;

  // Reset to initial state (logout / navigation cleanup)
  reset: () => void;
}

const initialState: MatchState = {
  isSimulating: false,
  lastMatch: null,
  matchError: null,
  replayFrames: [],
  replayMatch: null,
  isReplayLoading: false,
  replayError: null,
  latestMatch: null,
  replayLogs: [],
  replayStats: null,
};

const REPLAY_404_MESSAGE = 'Replay unavailable. This match cannot be watched.';
const REPLAY_FALLBACK_MESSAGE = 'Replay unavailable. Please try again.';

// In-flight frames request + generation token. Any state write after an
// await must prove it still owns the store: a superseded, cancelled or
// cleared load (tab switch, logout) must never resurrect replay state.
let replayAbort: AbortController | null = null;
let replayLoadSeq = 0;

/** A frame payload is playable only if it mirrors the engine's load guard */
const isPlayableFramesFile = (payload: MatchFramesFile | null): payload is MatchFramesFile => {
  const frames = payload?.frames;
  return (
    Array.isArray(frames) &&
    frames.length > 0 &&
    frames.every(
      (frame) =>
        frame &&
        Array.isArray(frame.players) &&
        frame.players.length > 0 &&
        frame.ball &&
        Array.isArray(frame.events)
    )
  );
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

      // AC #4 within a session: a freshly completed match becomes the
      // "watch last match" target immediately — no stale chip until the
      // next mount.
      set({
        isSimulating: false,
        lastMatch: match,
        matchError: null,
        latestMatch: match.status === 'completed' ? match : get().latestMatch,
      });
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

  loadReplay: async (matchId: string, match?: MatchResult) => {
    // No in-flight early-return: a new call SUPERSEDES the running one —
    // the generation token below invalidates the older load's writes and
    // its fetch is aborted (review: /match/A → /match/B mid-flight used to
    // swallow B and install A's frames under B's URL).

    // Resolve the owning match for the error/retry states: the explicit
    // argument wins, then any known match with that id.
    const knownMatch =
      [match, get().lastMatch, get().latestMatch].find((m) => m?.id === matchId) ?? null;

    // Generation token + abort wiring: a superseded or cancelled load must
    // never write state after its await (review: stale-response race).
    const seq = ++replayLoadSeq;
    replayAbort?.abort();
    replayAbort = new AbortController();
    const { signal } = replayAbort;

    // Release-on-success (review decision 2a): the previous replay stays
    // visible and playable while the new one downloads — the old array is
    // dropped in the same atomic set that installs the validated new
    // frames, so the replay UI (and its exit control) never blanks out
    // mid-reload.
    set({ isReplayLoading: true, replayError: null, replayMatch: knownMatch });

    // Deep link / refresh (story 7.7): no known match means the score pill
    // would fall back to "Challenger"/"Opponent" and the teams to the
    // default palette — resolve the metadata from GET /matches/{id}
    // alongside the frames. Its failure is cosmetic (fallback names): the
    // frames request owns the real error surface (401 logout, 404 wording).
    const framesRequest = apiFetch(`/matches/${encodeURIComponent(matchId)}/frames`, {
      signal,
    });
    const metadataRequest: Promise<MatchResult | null> = knownMatch
      ? Promise.resolve(null)
      : apiFetch(`/matches/${encodeURIComponent(matchId)}`, { signal })
          .then((response) => response.json() as Promise<MatchResult>)
          .catch(() => null);

    try {
      const [response, matchMeta] = await Promise.all([framesRequest, metadataRequest]);
      const payload = (await response.json().catch(() => null)) as MatchFramesFile | null;

      // Superseded, cancelled or cleared while in flight: the newer state
      // owns the store now.
      if (signal.aborted || seq !== replayLoadSeq) return;

      // A payload that cannot be played must surface the friendly error —
      // not crash the score derivation mid-render (AppShell computeScore)
      // nor hand the engine a dud it would silently ignore (Game.loadFrames).
      // An empty file too: a "successful" load with nothing to play would
      // be a silent dead click.
      if (!isPlayableFramesFile(payload)) {
        set({ isReplayLoading: false, replayError: REPLAY_404_MESSAGE });
        return;
      }

      // Atomic swap — the previous array's store reference dies here. The
      // log extraction runs once on the freshly validated frames (story 3.10:
      // memoized per load, never per render). The stats block is engine
      // truth taken as-is (story 7.9): null when the file predates telemetry.
      set({
        isReplayLoading: false,
        replayFrames: payload.frames,
        replayMatch: matchMeta?.id === matchId ? matchMeta : knownMatch,
        replayLogs: extractLogs(payload.frames),
        replayStats: payload.stats ?? null,
        replayError: null,
      });
    } catch (error) {
      // Cancelled or superseded: stay silent, the newer state owns the store.
      if (signal.aborted || seq !== replayLoadSeq) return;

      if (error instanceof ApiError && error.status === 401) {
        // Dead session (authStore precedent): a retry can never succeed —
        // log out so the auth gate takes over. Dynamic import: authStore
        // already imports this store, a static one would close a cycle.
        const { useAuthStore } = await import('./authStore');
        useAuthStore.getState().logout();
        set({ isReplayLoading: false, replayError: REPLAY_FALLBACK_MESSAGE });
        return;
      }

      // 404 (missing frames file) is a permanent state — retrying cannot
      // help; everything else might, so it offers the retry wording.
      const message =
        error instanceof ApiError && error.status === 404
          ? REPLAY_404_MESSAGE
          : REPLAY_FALLBACK_MESSAGE;

      set({ isReplayLoading: false, replayError: message });
    }
  },

  cancelReplayLoad: () => {
    // Abort the in-flight fetch; its catch sees the abort and stays silent.
    replayLoadSeq++;
    replayAbort?.abort();
    replayAbort = null;
    set({ isReplayLoading: false });
  },

  fetchLatestMatch: async () => {
    try {
      const response = await apiFetch('/matches');
      const payload = (await response.json().catch(() => null)) as {
        data?: MatchResult[];
      } | null;

      // The list is newest first (FR34): the first completed entry is the
      // most recent watchable match.
      const latest = payload?.data?.find((m) => m.status === 'completed') ?? null;

      set({ latestMatch: latest });
    } catch {
      // Transient failure: keep the previously known value — a working
      // "watch last match" entry must not disappear over one failed
      // refetch (review: error wipes a good value).
    }
  },

  clearReplay: () => {
    // Invalidate any in-flight load: a response arriving after the user
    // left replay mode (tab switch, logout) must not resurrect it.
    replayLoadSeq++;
    replayAbort?.abort();
    replayAbort = null;
    set({
      replayFrames: [],
      replayMatch: null,
      replayError: null,
      isReplayLoading: false,
      replayLogs: [],
      replayStats: null,
    });
  },

  reset: () => {
    replayLoadSeq++;
    replayAbort?.abort();
    replayAbort = null;
    set(initialState);
  },
}));
