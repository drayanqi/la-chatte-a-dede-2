/**
 * AppShell - Main layout with 3 panels
 * OWNER: Dev Team
 */

import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { TacticsCanvas, TacticsCanvasHandle } from '../canvas';
import { ScriptsPanel } from '../editor/ScriptsPanel';
import { DebuggerPanel } from '../debugger/DebuggerPanel';
import { TabBar } from '../tactics';
import { Header } from './Header';
import { Timeline } from './Timeline';
import { PanelDivider } from './PanelDivider';
import { MatchStatusOverlay } from './MatchStatusOverlay';
import { useCanvasStore, useEditorStore, useMatchStore, useTacticsStore } from '@/stores';
import { useAuthStore } from '@/stores/authStore';
import { usePanelLayout } from '@/hooks/usePanelLayout';
import { tacticConfigToTacticData, tacticDataToPlayerConfigs } from '@/lib/tacticBridge';
import { matchPlayerKey } from '@/lib/teamMapping';
import { computeScore, extractGoalTicks } from '@/lib/score';
import { shouldTogglePlayback } from '@/lib/playbackShortcuts';
import { isTypingContext } from '@/lib/keyboard';
import { TEST_LOAD_FRAMES_EVENT } from '@/lib/testHooks';
import type { MatchFrame, PlayerFrameState, TeamId } from '@/types';

/** How long the goal celebration layer stays mounted (ms) */
const CELEBRATION_DURATION_MS = 1500;

export const AppShell: React.FC = () => {
  const canvasRef = useRef<TacticsCanvasHandle>(null);

  // Loaded match frames (score derivation, from the canvas store) + goal
  // celebration state
  const matchFrames = useCanvasStore((state) => state.matchFrames);
  const setMatchFrames = useCanvasStore((state) => state.setMatchFrames);
  const [celebratingTeam, setCelebratingTeam] = useState<TeamId | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);

  // Collapsible/resizable workspace panels (persisted in localStorage)
  const {
    layout,
    resizeLeft,
    resizeRight,
    toggleLeft,
    toggleRight,
    resetSide,
    commit,
  } = usePanelLayout();

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
  const handlePlayerSelected = useCallback((playerId: string) => {
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
      }
      return;
    }

    canvas.setSelectedPlayer(playerId);
    canvas.setLogFilter(hasLogs ? playerId : null);
  }, []);

  const handlePlayerDeselected = useCallback(() => {
    const canvas = useCanvasStore.getState();
    canvas.setSelectedPlayer(null);
    canvas.setLogFilter(null);
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
    canvasRef.current?.loadFrames(replayFrames);
  }, [replayFrames, setMatchFrames, setSelectedPlayer, setLogFilter]);

  // Watch Replay (story 3.8, AC #1): load the finished match's frames
  const handleWatchReplay = useCallback(() => {
    if (!lastMatch || isReplayLoading) return;
    void loadReplay(lastMatch.id, lastMatch);
  }, [lastMatch, isReplayLoading, loadReplay]);

  // Watch last match (story 3.8, AC #4): one click to the most recent replay
  const handleWatchLastMatch = useCallback(() => {
    if (!latestMatch || isReplayLoading) return;
    void loadReplay(latestMatch.id, latestMatch);
  }, [latestMatch, isReplayLoading, loadReplay]);

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

  const handleScriptDropped = useCallback(
    (playerId: string, scriptId: string) => {
      console.log(`Script ${scriptId} assigned to player ${playerId}`);
    },
    []
  );

  // After a script deletion: detach player references. The database already
  // nulls tactic_player.script_id (FK nullOnDelete) — we only re-sync local
  // state (engine + tactics cache).
  const handleScriptDeleted = useCallback((scriptId: string) => {
    useTacticsStore.getState().detachScriptFromPlayers(scriptId);
    canvasRef.current?.detachScript(scriptId);
  }, []);

  // Practice match start/retry (story 3.5): the replay bindings above share
  // the same store subscription

  const handleStartPractice = useCallback(() => {
    if (!activeTactic || !lineupComplete || isSimulating) return;
    void startPracticeMatch(activeTactic.id);
  }, [activeTactic, lineupComplete, isSimulating, startPracticeMatch]);

  const handleRetryMatch = useCallback(() => {
    // Same guards as start: a lineup that became incomplete must not fire a
    // doomed request.
    if (!activeTactic || !lineupComplete || isSimulating) return;
    void startPracticeMatch(activeTactic.id);
  }, [activeTactic, lineupComplete, isSimulating, startPracticeMatch]);

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
  const navigate = useCallback(
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
        navigate(direction, event.shiftKey ? 60 : 1);
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
  }, [togglePlayback, navigate]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <Header
        lineupComplete={lineupComplete}
        isSimulating={isSimulating}
        onStartPractice={handleStartPractice}
      />

      {/* Tactic tabs (between header and field) */}
      <TabBar />

      {/* Practice match feedback: simulating overlay, result banner or error */}
      <MatchStatusOverlay
        isSimulating={isSimulating}
        match={lastMatch}
        error={matchError}
        onRetry={handleRetryMatch}
        onWatchReplay={handleWatchReplay}
      />

      {/* Main content */}
      <div style={styles.main}>
        {/* Scripts Panel (gauche): resizable, collapsible to a thin strip */}
        {layout.leftCollapsed ? (
          <button
            type="button"
            data-testid="panel-strip-left"
            aria-expanded={false}
            aria-controls="left-panel"
            onClick={toggleLeft}
            title="AI Scripts"
            style={styles.collapsedStripLeft}
          >
            <span style={styles.collapsedStripLabel}>AI Scripts</span>
            <span style={styles.collapsedStripArrow}>{'›'}</span>
          </button>
        ) : (
          <>
            <div
              id="left-panel"
              data-testid="left-panel"
              style={{ ...styles.leftPanel, width: `${layout.leftWidth}px` }}
            >
              <ScriptsPanel onScriptDeleted={handleScriptDeleted} />
            </div>
            <PanelDivider
              side="left"
              width={layout.leftWidth}
              onResize={resizeLeft}
              onCommit={commit}
              onReset={() => resetSide('left')}
              onToggle={toggleLeft}
            />
          </>
        )}

        {/* Canvas (centre) */}
        <div style={styles.centerPanel}>
          <TacticsCanvas
            ref={canvasRef}
            onPlayerSelected={handlePlayerSelected}
            onPlayerHovered={handlePlayerHovered}
            onFrameChanged={handleFrameChanged}
            onGoalScored={handleGoalScored}
            onScriptDropped={handleScriptDropped}
            onScriptAssigned={handleScriptAssigned}
            onPlayerMoved={handlePlayerMoved}
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

          {/* Watch last match (story 3.8, AC #4): subtle one-click entry to
              the most recent completed match; never auto-opens the viewer */}
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

          {/* Goal celebration layer (presence marker; visuals live in Pixi) */}
          {celebratingTeam && (
            <div data-testid="goal-celebration-layer" style={styles.celebrationLayer} />
          )}
        </div>

        {/* Debugger Panel (droite): resizable, collapsible to a thin strip */}
        {layout.rightCollapsed ? (
          <button
            type="button"
            data-testid="panel-strip-right"
            aria-expanded={false}
            aria-controls="right-panel"
            onClick={toggleRight}
            title="Debugger"
            style={styles.collapsedStripRight}
          >
            <span style={styles.collapsedStripLabel}>Debugger</span>
            <span style={styles.collapsedStripArrow}>{'‹'}</span>
          </button>
        ) : (
          <>
            <PanelDivider
              side="right"
              width={layout.rightWidth}
              onResize={resizeRight}
              onCommit={commit}
              onReset={() => resetSide('right')}
              onToggle={toggleRight}
            />
            <div
              id="right-panel"
              data-testid="right-panel"
              style={{ ...styles.rightPanel, width: `${layout.rightWidth}px` }}
            >
              <DebuggerPanel />
            </div>
          </>
        )}
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

const collapsedStripStyle: React.CSSProperties = {
  width: '36px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  padding: 0,
  paddingTop: '12px',
  backgroundColor: '#252526',
  border: 'none',
  cursor: 'pointer',
  overflow: 'hidden',
  userSelect: 'none',
  color: 'inherit',
  fontFamily: 'inherit',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: '#1e1e1e',
    color: '#ffffff',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
    flexShrink: 0,
    borderRight: '1px solid #3c3c3c',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  centerPanel: {
    flex: 1,
    minWidth: '320px',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
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
    padding: '6px 12px',
    backgroundColor: 'rgba(37, 37, 38, 0.85)',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    zIndex: 10,
    userSelect: 'none',
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
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '8px',
    zIndex: 10,
  },
  replayErrorText: {
    fontSize: '13px',
    color: '#f48771',
  },
  replayErrorRetryButton: {
    padding: '4px 12px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  replayLoadingOverlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.75)',
    zIndex: 1600,
  },
  replayLoadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  replayLoadingText: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
  },
  replayCancelButton: {
    padding: '6px 18px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  rightPanel: {
    flexShrink: 0,
    borderLeft: '1px solid #3c3c3c',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  collapsedStripLeft: {
    ...collapsedStripStyle,
    borderRight: '1px solid #3c3c3c',
  },
  collapsedStripRight: {
    ...collapsedStripStyle,
    borderLeft: '1px solid #3c3c3c',
  },
  collapsedStripLabel: {
    writingMode: 'vertical-rl',
    fontSize: '12px',
    color: '#cccccc',
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
  },
  collapsedStripArrow: {
    fontSize: '14px',
    color: '#9d9d9d',
  },
};
