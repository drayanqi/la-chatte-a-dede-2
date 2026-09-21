/**
 * AppShell - Teams page: teambar, scripts, code, pitch, replays
 * OWNER: Dev Team
 *
 * (Story 7.5 layout: Scripts | Code | Terrain flex, floating rounded
 * panels. Scripts and Code keep their mockup defaults (255px / 430px) but
 * stay resizable via PanelDivider; the widths persist in localStorage.
 * Script assignment happens via the on-pitch picker. Replay watching still
 * renders in-place here until the dedicated /match/:id broadcast view
 * takes over in 7.7.)
 */

import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TacticsCanvas, TacticsCanvasHandle } from '../canvas';
import { ScriptsPanel, CodePanel } from '../editor';
import { Teambar } from '../teams/Teambar';
import { ScriptPicker } from '../teams/ScriptPicker';
import { Appbar } from './Appbar';
import { Timeline } from './Timeline';
import { MatchStatusOverlay } from './MatchStatusOverlay';
import { PanelDivider } from './PanelDivider';
import {
  useCanvasStore,
  useEditorStore,
  useMatchStore,
  useTacticsStore,
} from '@/stores';
import { useAuthStore } from '@/stores/authStore';
import { tacticConfigToTacticData, tacticDataToPlayerConfigs } from '@/lib/tacticBridge';
import { matchPlayerKey } from '@/lib/teamMapping';
import { computeScore, extractGoalTicks } from '@/lib/score';
import { shouldTogglePlayback } from '@/lib/playbackShortcuts';
import { isTypingContext } from '@/lib/keyboard';
import { computePickerPosition } from '@/lib/pickerPosition';
import { TEST_LOAD_FRAMES_EVENT } from '@/lib/testHooks';
import type { MatchFrame, PlayerFrameState, Position, TeamId } from '@/types';

/** How long the goal celebration layer stays mounted (ms) */
const CELEBRATION_DURATION_MS = 1500;

/** Script assignment counts + labels helper: engine player id for a slot */
const enginePlayerIdForSlot = (slot: number): string => `home-${slot - 1}`;

// Panel resize bounds (story 7.5): mockup defaults, user-adjustable.
// The pitch never drops below MIN — the caps shrink on narrow viewports.
const TEAMS_PANELS_KEY = 'teams_panel_layout';
const DEFAULT_SCRIPTS_WIDTH = 255;
const DEFAULT_CODE_WIDTH = 430;
const MIN_SCRIPTS_WIDTH = 200;
const MIN_CODE_WIDTH = 320;
const ABS_MAX_SCRIPTS_WIDTH = 480;
const ABS_MAX_CODE_WIDTH = 820;
/** The pitch (flex) never shrinks below this width */
const MIN_PITCH_WIDTH = 320;
/** 8px gaps around each divider and panel */
const LAYOUT_CHROME_WIDTH = 40;

const clampWidth = (width: number, min: number, max: number): number =>
  Math.min(Math.max(Math.round(width), min), Math.max(min, max));

const loadTeamsPanelWidths = (): { scripts: number; code: number } => {
  try {
    const raw = localStorage.getItem(TEAMS_PANELS_KEY);
    if (!raw) {
      return { scripts: DEFAULT_SCRIPTS_WIDTH, code: DEFAULT_CODE_WIDTH };
    }
    const parsed = JSON.parse(raw) as { scripts?: unknown; code?: unknown };
    const viewport = typeof window === 'undefined' ? 1440 : window.innerWidth;
    const maxScripts = viewport - DEFAULT_CODE_WIDTH - MIN_PITCH_WIDTH - LAYOUT_CHROME_WIDTH;
    const maxCode = viewport - DEFAULT_SCRIPTS_WIDTH - MIN_PITCH_WIDTH - LAYOUT_CHROME_WIDTH;
    return {
      scripts: clampWidth(
        typeof parsed.scripts === 'number' ? parsed.scripts : DEFAULT_SCRIPTS_WIDTH,
        MIN_SCRIPTS_WIDTH,
        Math.min(ABS_MAX_SCRIPTS_WIDTH, maxScripts)
      ),
      code: clampWidth(
        typeof parsed.code === 'number' ? parsed.code : DEFAULT_CODE_WIDTH,
        MIN_CODE_WIDTH,
        Math.min(ABS_MAX_CODE_WIDTH, maxCode)
      ),
    };
  } catch {
    return { scripts: DEFAULT_SCRIPTS_WIDTH, code: DEFAULT_CODE_WIDTH };
  }
};

export const AppShell: React.FC = () => {
  const canvasRef = useRef<TacticsCanvasHandle>(null);
  const pitchPanelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Loaded match frames (score derivation, from the canvas store) + goal
  // celebration state
  const matchFrames = useCanvasStore((state) => state.matchFrames);
  const setMatchFrames = useCanvasStore((state) => state.setMatchFrames);
  const [celebratingTeam, setCelebratingTeam] = useState<TeamId | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);

  // Script picker state (story 7.5): the selected edit-mode player and the
  // frozen picker placement (viewport coords); its current script is derived
  // from the tactic
  const [pickerPlayer, setPickerPlayer] = useState<{
    id: string;
    number: number;
    x: number;
    y: number;
  } | null>(null);

  // Resizable panel widths (story 7.5): mockup defaults, persisted per device
  const [{ scripts: scriptsWidth, code: codeWidth }, setPanelWidths] = useState(loadTeamsPanelWidths);

  // Latest widths for the drag-end commit (onCommit carries no payload)
  const panelWidthsRef = useRef({ scripts: scriptsWidth, code: codeWidth });
  useEffect(() => {
    panelWidthsRef.current = { scripts: scriptsWidth, code: codeWidth };
  }, [scriptsWidth, codeWidth]);

  const persistPanelWidths = useCallback((next: { scripts: number; code: number }) => {
    try {
      localStorage.setItem(TEAMS_PANELS_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the resize still applies for this session
    }
  }, []);

  // Live clamp during a drag: the other panel keeps its current width and
  // the pitch keeps its minimum
  const clampScriptsWidth = useCallback(
    (width: number) =>
      clampWidth(
        width,
        MIN_SCRIPTS_WIDTH,
        Math.min(
          ABS_MAX_SCRIPTS_WIDTH,
          window.innerWidth - codeWidth - MIN_PITCH_WIDTH - LAYOUT_CHROME_WIDTH
        )
      ),
    [codeWidth]
  );

  const clampCodeWidth = useCallback(
    (width: number) =>
      clampWidth(
        width,
        MIN_CODE_WIDTH,
        Math.min(
          ABS_MAX_CODE_WIDTH,
          window.innerWidth - scriptsWidth - MIN_PITCH_WIDTH - LAYOUT_CHROME_WIDTH
        )
      ),
    [scriptsWidth]
  );

  const resizeScripts = useCallback(
    (width: number) => setPanelWidths(({ code }) => ({ code, scripts: clampScriptsWidth(width) })),
    [clampScriptsWidth]
  );

  const resizeCode = useCallback(
    (width: number) => setPanelWidths(({ scripts }) => ({ scripts, code: clampCodeWidth(width) })),
    [clampCodeWidth]
  );

  const handleScriptsResizeCommit = useCallback(() => {
    persistPanelWidths(panelWidthsRef.current);
  }, [persistPanelWidths]);

  const handleCodeResizeCommit = useCallback(() => {
    persistPanelWidths(panelWidthsRef.current);
  }, [persistPanelWidths]);

  const resetPanelWidths = useCallback(() => {
    setPanelWidths({ scripts: DEFAULT_SCRIPTS_WIDTH, code: DEFAULT_CODE_WIDTH });
    persistPanelWidths({ scripts: DEFAULT_SCRIPTS_WIDTH, code: DEFAULT_CODE_WIDTH });
  }, [persistPanelWidths]);

  const {
    selectedPlayerId,
    setSelectedPlayer,
    setLogFilter,
    setHoveredPlayer,
    updatePlaybackState,
    updatePlayerStates,
    setTacticLoaded,
    isPlaying,
    currentFrame,
    totalFrames,
  } = useCanvasStore();

  const { isAuthenticated } = useAuthStore();
  const { fetchScripts } = useEditorStore();

  // Match + replay playback state (story 3.8): the loaded frames, the owning
  // match, loading/error surfaces and the newest completed match (AC #4)
  const {
    isSimulating,
    lastMatch,
    matchError,
    startPracticeMatch,
    replayFrames,
    replayMatch,
    isReplayLoading,
    replayError,
    latestMatch,
    loadReplay,
    cancelReplayLoad,
    fetchLatestMatch,
    clearReplay,
  } = useMatchStore();

  const fetchTactics = useTacticsStore((state) => state.fetchTactics);
  const activeTacticId = useTacticsStore((state) => state.activeTacticId);
  const activeTactic = useTacticsStore((state) =>
    state.activeTacticId
      ? state.tactics.find((tactic) => tactic.id === state.activeTacticId) ?? null
      : null
  );

  // Track which tactic id is currently loaded in the canvas
  const loadedTacticIdRef = useRef<string | null>(null);

  // The canvas engine dies with this component (route switch away and
  // back, StrictMode double-mount): a fresh engine instance must reload
  // the active tactic even though the id did not change. Declared BEFORE
  // the load effect so each remount pass clears the dedupe guard first.
  useEffect(() => {
    loadedTacticIdRef.current = null;
  }, []);

  // Lineup gating: all 5 slots must exist and have a script assigned
  const lineupComplete = activeTactic
    ? activeTactic.players.length === 5 &&
      activeTactic.players.every((player) => player.scriptId !== null)
    : false;

  // Fetch user scripts when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchScripts();
    }
  }, [isAuthenticated, fetchScripts]);

  // Fetch saved tactics when authenticated; always keep at least one
  // (story 3.2 AC #6: a user without tactics gets a default one auto-created)
  useEffect(() => {
    if (!isAuthenticated) return;

    void (async () => {
      await fetchTactics();

      const {
        tactics,
        activeTacticId: fetchedActiveId,
        selectTactic,
        createTactic,
        tacticsError,
      } = useTacticsStore.getState();

      // Fetch failed: do not decide anything from an empty list (a spurious
      // default tactic would be POSTed on every reload until the fetch works)
      if (tacticsError) return;

      const userTactics = tactics.filter((tactic) => !tactic.isSystem);

      if (userTactics.length === 0) {
        await createTactic();
        return;
      }

      // Keep the remembered selection, else fall back to the first tactic
      const target =
        userTactics.find((tactic) => tactic.id === fetchedActiveId) ?? userTactics[0] ?? null;

      if (target) {
        selectTactic(target.id);
      }
    })();
  }, [isAuthenticated, fetchTactics]);

  // Load the active tactic into the canvas whenever it changes (tab switch,
  // creation, deletion promotion, hydration)
  useEffect(() => {
    if (!activeTacticId || loadedTacticIdRef.current === activeTacticId) return;

    const { tactics } = useTacticsStore.getState();
    const target = tactics.find((tactic) => tactic.id === activeTacticId);
    if (!target) return;

    // A replay is loading or loaded (deep link / watch navigation lands the
    // user here mid-load): it owns the canvas when it lands — don't clobber
    // it with the tactic load, and don't clear the in-flight frames
    const { isReplayLoading, replayFrames } = useMatchStore.getState();
    if (isReplayLoading || replayFrames.length > 0) return;

    loadedTacticIdRef.current = activeTacticId;
    setSelectedPlayer(null);
    setLogFilter(null);
    canvasRef.current?.loadTactic(tacticConfigToTacticData(target));
    // A tactic load ends any replay (the engine just dropped its frames):
    // clear the match state so the score display and playback follow
    setMatchFrames([]);
    clearReplay();
    // The engine reset its playback silently (loadTacticInternal emits
    // nothing): sync the store or the Timeline keeps showing a stale
    // playing/frame-N state from the dropped replay
    updatePlaybackState(false, 0, 0);
    updatePlayerStates([]);
    setTacticLoaded(true);
  }, [
    activeTacticId,
    setMatchFrames,
    setTacticLoaded,
    setSelectedPlayer,
    setLogFilter,
    clearReplay,
    updatePlaybackState,
    updatePlayerStates,
  ]);

  // "Watch last match" (story 3.8, AC #4): resolve the newest completed
  // match once when authenticated so the subtle entry can appear
  useEffect(() => {
    if (isAuthenticated) {
      void fetchLatestMatch();
    }
  }, [isAuthenticated, fetchLatestMatch]);

  // Mirror the persistent selection into the engine so exactly the selected
  // player keeps its ring (single source of truth: the store)
  useEffect(() => {
    canvasRef.current?.setSelectedPlayer(selectedPlayerId);
  }, [selectedPlayerId]);

  // Canvas callbacks

  /**
   * Pitch click (story 3.11): ONE handler owns the selection → log-filter
   * semantics for both modes.
   * - New player: select it (pitch highlight, existing mirror effect) and
   *   filter the logs to it — but only when it actually logged; in edit
   *   mode (no replay) nothing is filtered.
   * - Re-click on the selected player with logs: toggle the LOG FILTER off
   *   and keep the highlight (AC #2; deselection stays on empty pitch).
   * - Re-click without logs: historical deselect toggle.
   * The engine never decides semantics — it only reports the click.
   */
  const handlePlayerSelected = useCallback(
    (playerId: string, _teamId: TeamId, position: Position, _scriptId: string | null) => {
      const canvas = useCanvasStore.getState();
      const wasSelected = canvas.selectedPlayerId === playerId;
      const hasLogs = useMatchStore
        .getState()
        .replayLogs.some((entry) => matchPlayerKey(entry.team, entry.slot) === playerId);

      if (wasSelected) {
        if (hasLogs) {
          canvas.setLogFilter(canvas.logFilterPlayerId === playerId ? null : playerId);
        } else {
          canvas.setSelectedPlayer(null);
          setPickerPlayer(null);
        }
        return;
      }

      canvas.setSelectedPlayer(playerId);
      canvas.setLogFilter(hasLogs ? playerId : null);

      // Story 7.5: the picker targets edit-mode players (replay mode keeps
      // the selection + log-filter semantics only). The placement is frozen
      // at selection time (viewport coords, clamped to the pitch panel) —
      // refs are read here, in an event handler, never during render.
      // Engine ids: home-{n}.
      if (useMatchStore.getState().replayFrames.length === 0) {
        const slot = Number(playerId.split('-')[1]);
        const rect = pitchPanelRef.current?.getBoundingClientRect();
        const placement = rect
          ? computePickerPosition(position.x, position.y, {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            })
          : null;

        if (placement) {
          setPickerPlayer({
            id: playerId,
            number: Number.isNaN(slot) ? 0 : slot + 1,
            x: placement.x,
            y: placement.y,
          });
        } else {
          setPickerPlayer(null);
        }
      }
    },
    []
  );

  const handlePlayerDeselected = useCallback(() => {
    const canvas = useCanvasStore.getState();
    canvas.setSelectedPlayer(null);
    canvas.setLogFilter(null);
    setPickerPlayer(null);
  }, []);

  // A drag that actually moves the player hides the picker (story 7.5): the
  // pointerdown opened it before the engine could tell tap from drag.
  // The selection ring stays — it is the drag's positional feedback.
  const handlePlayerDragStart = useCallback(() => {
    setPickerPlayer(null);
  }, []);

  const handlePlayerHovered = useCallback(
    (playerId: string | null) => {
      setHoveredPlayer(playerId);
    },
    [setHoveredPlayer]
  );

  const handleFrameChanged = useCallback(
    (
      frame: number,
      total: number,
      states: PlayerFrameState[],
      _ball: { x: number; y: number },
      playing: boolean
    ) => {
      updatePlaybackState(playing, frame, total);
      updatePlayerStates(states);
    },
    [updatePlaybackState, updatePlayerStates]
  );

  // Goal scored (story 3.7): flash/confetti live in the engine (Pixi); the
  // shell mounts the celebration layer + lets the score display update.
  const handleGoalScored = useCallback((team: TeamId) => {
    if (celebrationTimerRef.current !== null) {
      window.clearTimeout(celebrationTimerRef.current);
    }
    setCelebratingTeam(team);
    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebratingTeam(null);
      celebrationTimerRef.current = null;
    }, CELEBRATION_DURATION_MS);
  }, []);

  // Clear a pending celebration timer on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  // Test-only frame injection (story 3.7): lets E2E drive the full
  // frame -> sprites -> ball -> score pipeline before 3.8 wires replays.
  useEffect(() => {
    const handleTestLoadFrames = (event: Event) => {
      const detail = (event as CustomEvent<{ frames?: MatchFrame[] }>).detail;
      const frames = detail?.frames;
      if (!Array.isArray(frames) || frames.length === 0) return;
      setMatchFrames(frames);
      canvasRef.current?.loadFrames(frames);
    };
    window.addEventListener(TEST_LOAD_FRAMES_EVENT, handleTestLoadFrames);
    return () => window.removeEventListener(TEST_LOAD_FRAMES_EVENT, handleTestLoadFrames);
  }, [setMatchFrames]);

  // Live score: replayed from the goal events up to the current frame
  const score = useMemo(
    () => computeScore(matchFrames, currentFrame),
    [matchFrames, currentFrame]
  );

  // Goal markers for the timeline scrubber (story 3.9, Task 3): precomputed
  // once per replay load — pure positions + scoring teams
  const goalTicks = useMemo(() => extractGoalTicks(matchFrames), [matchFrames]);

  // Replay mode: a loaded replay owns the canvas (edit mode shows the tactic)
  const isReplayMode = replayFrames.length > 0;

  // Hand a freshly loaded replay to the engine (autoplay starts inside
  // loadFrames) and mirror the same array reference into the score slice —
  // one parse, one array, no duplicated frames across slices
  useEffect(() => {
    if (replayFrames.length === 0) return;
    setSelectedPlayer(null);
    setLogFilter(null);
    setMatchFrames(replayFrames);
    // Team colors of the replayed match (story 7.4): challenger paints home,
    // opponent away. A practice opponent keeps the default palette.
    canvasRef.current?.setTeamColors(
      replayMatch?.challengerColorPrimary ?? undefined,
      replayMatch?.opponentColorPrimary ?? undefined
    );
    canvasRef.current?.loadFrames(replayFrames);
  }, [replayFrames, replayMatch, setMatchFrames, setSelectedPlayer, setLogFilter]);

  // Live team recolor (story 7.4): an Équipement save updates the active
  // tactic in place — no reload, the players and goals repaint immediately
  // (redundant calls are no-ops: the engine skips same-color repaints)
  useEffect(() => {
    if (!activeTactic || isReplayMode) return;
    canvasRef.current?.setTeamColors(activeTactic.colorPrimary, activeTactic.colorSecondary);
  }, [activeTactic, isReplayMode]);

  // Script tags (story 7.5): engine player id -> assigned script name.
  // Recomputed when the lineup or the script list changes (renames included).
  const editorScripts = useEditorStore((state) => state.scripts);
  const syntaxErrors = useEditorStore((state) => state.syntaxErrors);
  useEffect(() => {
    if (!activeTactic || isReplayMode) return;

    const labels: Record<string, string | null> = {};
    for (const slot of activeTactic.players) {
      labels[enginePlayerIdForSlot(slot.playerSlot)] = slot.scriptId
        ? editorScripts.get(slot.scriptId)?.name ?? null
        : null;
    }
    canvasRef.current?.setScriptLabels(labels);
  }, [activeTactic, editorScripts, isReplayMode]);

  // Watch Replay (story 3.8, AC #1 — 7.5: lands in the /match/:id viewer)
  const handleWatchReplay = useCallback(() => {
    if (!lastMatch || isReplayLoading) return;
    navigate(`/match/${lastMatch.id}`);
  }, [lastMatch, isReplayLoading, navigate]);

  // Watch last match (story 3.8, AC #4 — 7.5: lands in the /match/:id viewer)
  const handleWatchLastMatch = useCallback(() => {
    if (!latestMatch || isReplayLoading) return;
    navigate(`/match/${latestMatch.id}`);
  }, [latestMatch, isReplayLoading, navigate]);

  // Retry after a replay load failure (AC: 3.5 #4 philosophy)
  const handleReplayRetry = useCallback(() => {
    if (!replayMatch || isReplayLoading) return;
    void loadReplay(replayMatch.id, replayMatch);
  }, [replayMatch, isReplayLoading, loadReplay]);

  // Back to editor (story 3.8): exit replay mode and restore the active
  // tactic — the engine dropped its replay sprites on tactic load
  const handleBackToEditor = useCallback(() => {
    clearReplay();
    setMatchFrames([]);
    updatePlaybackState(false, 0, 0);
    updatePlayerStates([]);
    // Replay-scoped state must not survive the replay's exit: the filter
    // and the match-key selection are meaningless in edit mode, and the
    // engine already dropped its ring on loadTactic — a surviving store
    // selection would be a phantom no empty-pitch click could clear
    setSelectedPlayer(null);
    setLogFilter(null);

    const { tactics, activeTacticId: currentActiveId } = useTacticsStore.getState();
    const target = currentActiveId ? tactics.find((tactic) => tactic.id === currentActiveId) : null;
    if (target) {
      canvasRef.current?.loadTactic(tacticConfigToTacticData(target));
      setTacticLoaded(true);
    } else {
      // No tactic to restore: at least stop the engine — otherwise the
      // replay keeps rendering (playing or frozen) behind the edit-mode
      // UI with no exit control to escape it
      canvasRef.current?.pause();
      canvasRef.current?.seekFrame(0);
      setTacticLoaded(false);
    }
  }, [
    clearReplay,
    setMatchFrames,
    updatePlaybackState,
    updatePlayerStates,
    setTacticLoaded,
    setSelectedPlayer,
    setLogFilter,
  ]);

  // Cancel a replay load in flight (review decision 3c): unblock the UI
  const handleCancelReplayLoad = useCallback(() => {
    cancelReplayLoad();
  }, [cancelReplayLoad]);

  // Auto-save (story 3.2): a discrete action completion — script assignment
  // or player move-end — reads the engine state back and persists it
  // immediately. Discrete actions only; never mid-drag.
  const persistActiveTacticFromEngine = useCallback(() => {
    const { activeTacticId: currentActiveId, updateTactic } = useTacticsStore.getState();

    if (!isAuthenticated || !currentActiveId) return; // no tactic behind the field yet

    const engineTactic = canvasRef.current?.getTactic();
    if (!engineTactic || engineTactic.id !== currentActiveId) return;

    void updateTactic(currentActiveId, undefined, tacticDataToPlayerConfigs(engineTactic));
  }, [isAuthenticated]);

  const handleScriptAssigned = useCallback(() => {
    persistActiveTacticFromEngine();
  }, [persistActiveTacticFromEngine]);

  const handlePlayerMoved = useCallback(() => {
    persistActiveTacticFromEngine();
  }, [persistActiveTacticFromEngine]);

  // After a script deletion: detach player references. The database already
  // nulls tactic_player.script_id (FK nullOnDelete) — we only re-sync local
  // state (engine + tactics cache).
  const handleScriptDeleted = useCallback((scriptId: string) => {
    useTacticsStore.getState().detachScriptFromPlayers(scriptId);
    canvasRef.current?.detachScript(scriptId);
  }, []);

  // Practice match start/retry (story 3.5, handoff story 7.5): the match
  // runs synchronously, then the route moves to the /match/:id viewer.
  // A failure stays on the page (error banner + retry).

  const handleStartPractice = useCallback(() => {
    if (!activeTactic || !lineupComplete || isSimulating) return;

    void (async () => {
      await startPracticeMatch(activeTactic.id);
      const { lastMatch, matchError } = useMatchStore.getState();
      if (lastMatch && lastMatch.status === 'completed' && !matchError) {
        navigate(`/match/${lastMatch.id}`);
      }
    })();
  }, [activeTactic, lineupComplete, isSimulating, startPracticeMatch, navigate]);

  const handleRetryMatch = useCallback(() => {
    // Same guards as start: a lineup that became incomplete must not fire a
    // doomed request.
    if (!activeTactic || !lineupComplete || isSimulating) return;

    void (async () => {
      await startPracticeMatch(activeTactic.id);
      const { lastMatch, matchError } = useMatchStore.getState();
      if (lastMatch && lastMatch.status === 'completed' && !matchError) {
        navigate(`/match/${lastMatch.id}`);
      }
    })();
  }, [activeTactic, lineupComplete, isSimulating, startPracticeMatch, navigate]);

  // Contrôles de lecture
  const handlePlay = useCallback(() => {
    canvasRef.current?.play();
    updatePlaybackState(true, currentFrame, totalFrames);
  }, [updatePlaybackState, currentFrame, totalFrames]);

  const handlePause = useCallback(() => {
    canvasRef.current?.pause();
    updatePlaybackState(false, currentFrame, totalFrames);
  }, [updatePlaybackState, currentFrame, totalFrames]);

  const handleStep = useCallback(
    (direction: 'forward' | 'backward') => {
      canvasRef.current?.step(direction);
    },
    []
  );

  const handleSeek = useCallback((frame: number) => {
    canvasRef.current?.seekFrame(frame);
  }, []);

  // Space play/pause (story 3.8, AC #3): toggle only when the keystroke does
  // not belong to an editor surface (Monaco textarea, inputs)
  const togglePlayback = useCallback(() => {
    const { isPlaying: playing, currentFrame: frame, totalFrames: total } =
      useCanvasStore.getState();

    // Nothing loaded: no-op (the Timeline itself is hidden outside replay
    // mode) — toggling would set a phantom "playing" state with zero frames
    if (total === 0) return;

    if (playing) {
      canvasRef.current?.pause();
      updatePlaybackState(false, frame, total);
    } else {
      canvasRef.current?.play();
      updatePlaybackState(true, frame, total);
    }
  }, [updatePlaybackState]);

  // Arrow navigation (story 3.9, AC #3/#4): ±1 tick per press, ±60 ticks
  // (1 second at the engine's 60 fps) with Shift. While paused, the step
  // renders immediately (single frame apply, no play() call).
  const stepPlayback = useCallback(
    (direction: 'forward' | 'backward', ticks: number) => {
      const { isPlaying: playing, currentFrame: frame, totalFrames: total } =
        useCanvasStore.getState();

      // Nothing loaded: same guard as the disabled Timeline controls
      if (total === 0) return;

      // Stepping while playing pauses first (video-player convention)
      if (playing) {
        canvasRef.current?.pause();
        updatePlaybackState(false, frame, total);
      }

      if (ticks === 1) {
        canvasRef.current?.step(direction);
      } else {
        const delta = ticks * (direction === 'forward' ? 1 : -1);
        const target = Math.min(Math.max(0, frame + delta), Math.max(0, total - 1));
        canvasRef.current?.seekFrame(target);
      }
    },
    [updatePlaybackState]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Arrow navigation (story 3.9): auto-repeat stays welcome (hold to
      // scrub) — only typing surfaces steal the keys
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Same chord policy as the Space path: Ctrl/Alt/Meta combos belong
        // to the OS/browser (desktop switching, word-jump) — never hijack
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (isTypingContext(event)) return;
        // Only swallow the keys when a replay can actually navigate —
        // otherwise arrow scrolling dies app-wide for nothing
        if (useCanvasStore.getState().totalFrames === 0) return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 'forward' : 'backward';
        stepPlayback(direction, event.shiftKey ? 60 : 1);
        return;
      }

      // Ignore auto-repeat: a held Space would machine-gun the toggle
      if (event.repeat) return;
      if (!shouldTogglePlayback(event)) return;
      // Swallow the default: page scroll (buttons and links keep their
      // native Space activation — shouldTogglePlayback excludes them)
      event.preventDefault();
      togglePlayback();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayback, stepPlayback]);

  return (
    <div style={styles.container}>
      {/* Appbar (La Ronde, story 7.1) */}
      <Appbar />

      {/* Teambar (story 7.5): pills + caret menu + status + Test vs Bot */}
      <Teambar
        lineupComplete={lineupComplete}
        isSimulating={isSimulating}
        onStartPractice={handleStartPractice}
      />

      {/* Main content: Scripts | Code | Terrain flex (story 7.5, resizable) */}
      <div style={styles.main}>
        <div data-testid="left-panel" style={{ ...styles.leftPanel, width: `${scriptsWidth}px` }}>
          <ScriptsPanel onScriptDeleted={handleScriptDeleted} />
        </div>

        <PanelDivider
          side="left"
          id="scripts"
          width={scriptsWidth}
          onResize={resizeScripts}
          onCommit={handleScriptsResizeCommit}
          onReset={resetPanelWidths}
          label="Resize scripts panel"
        />

        <div data-testid="code-panel-shell" style={{ ...styles.codePanel, width: `${codeWidth}px` }}>
          <CodePanel />
        </div>

        <PanelDivider
          side="left"
          id="code"
          width={codeWidth}
          onResize={resizeCode}
          onCommit={handleCodeResizeCommit}
          onReset={resetPanelWidths}
          label="Resize code panel"
        />

        {/* Terrain (droite) */}
        <div data-testid="pitch-panel" ref={pitchPanelRef} style={styles.centerPanel}>
          <TacticsCanvas
            ref={canvasRef}
            onPlayerSelected={handlePlayerSelected}
            onPlayerHovered={handlePlayerHovered}
            onFrameChanged={handleFrameChanged}
            onGoalScored={handleGoalScored}
            onScriptAssigned={handleScriptAssigned}
            onPlayerMoved={handlePlayerMoved}
            onPlayerDragStart={handlePlayerDragStart}
            onPlayerDeselected={handlePlayerDeselected}
          />

          {/* Score display (story 3.7, AC #3): only while a match is loaded */}
          {matchFrames.length > 0 && (
            <div data-testid="score-display" style={styles.scoreDisplay}>
              {score.challenger} — {score.opponent}
            </div>
          )}

          {/* Back to editor (story 3.8): exit replay mode to the workspace */}
          {isReplayMode && (
            <button
              type="button"
              data-testid="back-to-editor-button"
              onClick={handleBackToEditor}
              aria-label="Exit replay, back to tactic editor"
              style={styles.replayCornerButton}
            >
              ← Back to editor
            </button>
          )}

          {/* Watch last match (story 3.8, AC #4, 7.5: /match/:id handoff) */}
          {latestMatch && !isReplayMode && !isReplayLoading && !replayError && (
            <button
              type="button"
              data-testid="watch-last-match-button"
              onClick={handleWatchLastMatch}
              aria-label="Watch the replay of the most recent completed match"
              style={styles.replayCornerButton}
            >
              ▶ Watch last match
            </button>
          )}

          {/* Replay load failure (story 3.8): friendly state + retry (same
              philosophy as 3.5 AC #4) */}
          {replayError && (
            <div data-testid="replay-error-banner" role="alert" style={styles.replayErrorBanner}>
              <span data-testid="replay-error-message" style={styles.replayErrorText}>
                {replayError}
              </span>
              <button
                type="button"
                data-testid="replay-retry-button"
                onClick={handleReplayRetry}
                style={styles.replayErrorRetryButton}
              >
                Retry
              </button>
            </div>
          )}

          {/* Replay loading (story 3.8, AC #1): blocks the UI while the
              ~5-8MB frame file downloads, with a cancel affordance (review
              decision 3c) so a hung request cannot brick the workspace */}
          {isReplayLoading && (
            <div
              data-testid="replay-loading-overlay"
              role="status"
              aria-live="polite"
              aria-busy="true"
              style={styles.replayLoadingOverlay}
            >
              <div style={styles.replayLoadingContent}>
                <span style={styles.replayLoadingText}>Loading replay...</span>
                <button
                  type="button"
                  data-testid="replay-cancel-button"
                  onClick={handleCancelReplayLoad}
                  style={styles.replayCancelButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Practice match feedback (story 3.5 + 7.5 handoff): simulating
              overlay pinned to the pitch, error banner */}
          <MatchStatusOverlay
            isSimulating={isSimulating}
            match={lastMatch}
            error={matchError}
            onRetry={handleRetryMatch}
            onWatchReplay={handleWatchReplay}
          />

          {/* Script picker (story 7.5): edit mode only, at the frozen
              placement captured when the player was selected. Gated on the
              live selection: a tactic switch or replay clears it through
              the store without a cascading local-state reset. */}
          {pickerPlayer && selectedPlayerId === pickerPlayer.id && !isReplayMode
            ? (() => {
                const currentScriptId =
                  activeTactic?.players.find(
                    (slot) => enginePlayerIdForSlot(slot.playerSlot) === pickerPlayer.id
                  )?.scriptId ?? null;

                const pickerScripts = Array.from(editorScripts.values()).map((script) => ({
                  id: script.id,
                  name: script.name,
                  status: (syntaxErrors.some((error) => error.scriptId === script.id)
                    ? 'err'
                    : 'ok') as 'ok' | 'err',
                  usage: activeTactic
                    ? activeTactic.players.filter((slot) => slot.scriptId === script.id).length
                    : 0,
                }));

                return (
                  <ScriptPicker
                    playerNumber={pickerPlayer.number}
                    x={pickerPlayer.x}
                    y={pickerPlayer.y}
                    scripts={pickerScripts}
                    currentScriptId={currentScriptId}
                    onAssign={(scriptId) => {
                      canvasRef.current?.assignScript(pickerPlayer.id, scriptId);
                    }}
                    onRemove={() => {
                      canvasRef.current?.detachPlayerScript(pickerPlayer.id);
                      persistActiveTacticFromEngine();
                    }}
                    onClose={handlePlayerDeselected}
                  />
                );
              })()
            : null}

          {/* Goal celebration layer (presence marker; visuals live in Pixi) */}
          {celebratingTeam && (
            <div data-testid="goal-celebration-layer" style={styles.celebrationLayer} />
          )}
        </div>
      </div>

      {/* Timeline: only in replay mode — there is nothing to pause,
          play or scrub in edit mode */}
      {isReplayMode && (
        <Timeline
          isPlaying={isPlaying}
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          goalTicks={goalTicks}
          onPlay={handlePlay}
          onPause={handlePause}
          onStep={handleStep}
          onSeek={handleSeek}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    color: 'var(--ink)',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    padding: '8px',
    gap: '2px',
    minHeight: 0,
  },
  leftPanel: {
    flexShrink: 0,
    borderRadius: 'var(--r)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow)',
    backgroundColor: 'var(--panel)',
  },
  codePanel: {
    flexShrink: 0,
    borderRadius: 'var(--r)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow)',
    backgroundColor: 'var(--panel)',
  },
  centerPanel: {
    flex: 1,
    minWidth: '320px',
    overflow: 'hidden',
    borderRadius: 'var(--r)',
    boxShadow: 'var(--shadow)',
    position: 'relative',
  },
  scoreDisplay: {
    position: 'absolute',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '24px',
    lineHeight: 1.2,
    fontWeight: 600,
    color: '#ffffff',
    textShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
    pointerEvents: 'none',
    zIndex: 10,
    userSelect: 'none',
  },
  celebrationLayer: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 20,
  },
  replayCornerButton: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    padding: '7px 13px',
    backgroundColor: 'rgba(10, 20, 14, 0.6)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '11px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
    zIndex: 10,
    userSelect: 'none',
    backdropFilter: 'blur(4px)',
  },
  replayErrorBanner: {
    position: 'absolute',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-btn, 13px)',
    boxShadow: 'var(--shadow)',
    zIndex: 10,
  },
  replayErrorText: {
    fontSize: '13px',
    color: 'var(--corail)',
  },
  replayErrorRetryButton: {
    padding: '6px 14px',
    backgroundColor: 'var(--corail)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--r-btn, 13px)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
  },
  replayLoadingOverlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 20, 14, 0.55)',
    zIndex: 1600,
    backdropFilter: 'blur(3px)',
  },
  replayLoadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  replayLoadingText: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '0.04em',
  },
  replayCancelButton: {
    padding: '9px 18px',
    backgroundColor: 'var(--corail)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--r-btn, 13px)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
  },
};
