/**
 * MatchPage - The broadcast replay route (stories 7.2 + 7.7)
 *
 * Deep-linkable /match/:id viewer: loads the match's frames on mount
 * (refresh-safe), renders the broadcast anatomy — floating score pill with
 * team colors, exit chip, TacticsCanvas pitch, celebration overlay, the
 * video-editor timeline (skip/speed/scrubber) and the logs/stats drawer.
 * Playback keyboard shortcuts (Space/arrows) live here since the 7.7
 * cutover: the workspace retired its replay path.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TacticsCanvas, TacticsCanvasHandle } from '@/components/canvas';
import { Appbar } from '@/components/layout/Appbar';
import { Timeline } from '@/components/layout/Timeline';
import { ReplayDrawer } from '@/components/match/ReplayDrawer';
import { shouldTogglePlayback } from '@/lib/playbackShortcuts';
import { isTypingContext } from '@/lib/keyboard';
import { TEST_LOAD_FRAMES_EVENT } from '@/lib/testHooks';
import { useCanvasStore } from '@/stores/canvasStore';
import { useMatchStore } from '@/stores/matchStore';
import { resolveMatchKits } from '@/lib/teamColors';
import { matchPlayerKey } from '@/lib/teamMapping';
import { formatTime } from '@/lib/timeFormat';
import { computeScore, extractGoalEvents, extractGoalTicks } from '@/lib/score';
import { extractFrameEvents } from '@/lib/matchEvents';
import type { MatchFrame, PlayerFrameState, TeamId } from '@/types';

/** Celebration banner lifetime when the goal frame is reached while paused
 * (seek/step onto it) — no countdown, playback untouched */
const CELEBRATION_BANNER_MS = 1500;
/** Live goal: playback freezes on the kickoff frame — teams in place,
 * conceding GK holding the ball — for a 3s countdown. The score card owns
 * the first beat, then only the countdown remains until the resume. */
const CELEBRATION_TOTAL_MS = 3000;
const CELEBRATION_SCORE_HOLD_MS = 1200;
const CELEBRATION_COUNTDOWN_TICKS = 3;
const CELEBRATION_POLL_MS = 100;

/** Pre-match ceremony (story 7.10): the walk itself is engine-driven
 * (onIntroComplete); the kickoff countdown reuses the goal celebration's
 * 3-2-1 cadence — no score anywhere, nothing is 0-0 yet. */
const INTRO_COUNTDOWN_TICKS = 3;
const INTRO_TOTAL_MS = 3000;
const INTRO_POLL_MS = 100;

interface Celebration {
  team: TeamId;
  scorerSlot: number | null;
  live: boolean;
}

export const MatchPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<TacticsCanvasHandle>(null);

  const {
    replayFrames,
    replayMatch,
    replayLogs,
    replayStats,
    isReplayLoading,
    replayError,
    loadReplay,
    cancelReplayLoad,
    clearReplay,
  } = useMatchStore();

  const {
    currentFrame,
    totalFrames,
    isPlaying,
    selectedPlayerId,
    logFilterPlayerId,
    updatePlaybackState,
    updatePlayerStates,
    setMatchFrames,
    setSelectedPlayer,
    setLogFilter,
  } = useCanvasStore();

  // Mirror the persistent selection into the engine so exactly the selected
  // player keeps its ring (single source of truth: the store) — covers the
  // drawer-chip selection path (story 3.11); the engine handles its own
  // ring on direct pitch clicks
  useEffect(() => {
    canvasRef.current?.setSelectedPlayer(selectedPlayerId);
  }, [selectedPlayerId]);

  // Playback speed state was folded into the Timeline (remounts per replay)

  // Goal celebration overlay (story 7.7): scorer line + big center score;
  // a live goal adds the 3-2-1 countdown — score card first, countdown
  // alone after — and freezes/resumes playback around it
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [scorePhase, setScorePhase] = useState(true);
  const celebrationTimerRef = useRef<number | null>(null);

  // Pre-match ceremony (story 7.10): 'walk' = teams entering under the VS
  // card (engine tween, no React timer), 'countdown' = 3-2-1 then kickoff.
  // The ref mirror keeps the keyboard/overlay handlers honest without
  // re-binding them on every phase change.
  const [introPhase, setIntroPhase] = useState<'walk' | 'countdown' | null>(null);
  const [introCountdown, setIntroCountdown] = useState(0);
  const introPhaseRef = useRef<'walk' | 'countdown' | null>(null);
  const introTimerRef = useRef<number | null>(null);
  // The ceremony plays once per fresh generation (?fresh=1 from the play
  // flows) — a ref: consumed atomically with the frames load, immune to
  // the param being stripped afterwards
  const introEligibleRef = useRef(false);

  const applyIntroPhase = useCallback((phase: 'walk' | 'countdown' | null) => {
    introPhaseRef.current = phase;
    setIntroPhase(phase);
  }, []);

  // ?fresh=1 (story 7.10): the play flows navigate right after the match
  // was generated. The flag is consumed on mount and stripped with replace
  // — a refresh (or a history-row visit) loads without the ceremony.
  // Declared before the frames-load effect: the ref must be set by the
  // time frames arrive.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('fresh') !== '1') return;
    introEligibleRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('fresh');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Load the requested replay once (refresh-safe deep link): a mismatched
  // or absent match triggers the load. A load still in flight for ANOTHER
  // id is superseded (matchStore generation token + abort) — never left
  // running to install the wrong frames under this URL.
  // Deliberately keyed on the route id only — the store guards
  // (replayMatch) are read at run time.
  useEffect(() => {
    if (!id) return;
    if (useMatchStore.getState().replayMatch?.id === id) return;
    void loadReplay(id);
  }, [id, loadReplay]);

  // Leaving the route drops the replay (the next visit re-loads it)
  useEffect(() => {
    return () => {
      cancelReplayLoad();
      clearReplay();
      setMatchFrames([]);
      updatePlaybackState(false, 0, 0);
      updatePlayerStates([]);
      setSelectedPlayer(null);
      setLogFilter(null);
    };
  }, [
    cancelReplayLoad,
    clearReplay,
    setMatchFrames,
    updatePlaybackState,
    updatePlayerStates,
    setSelectedPlayer,
    setLogFilter,
  ]);

  // Hand a freshly loaded replay to the engine (autoplay starts inside
  // loadFrames) and mirror it into the score slice. Team colors of the
  // replayed match (story 7.4): challenger paints home, opponent away —
  // a practice opponent keeps the default palette. The away side is
  // resolved against home (story 7.6 feedback, its own secondary included):
  // two teams with the same color would paint all 10 players identically.
  // Speed resets with the replay: every match starts at 1x, never the
  // previous match's tempo.
  useEffect(() => {
    if (replayFrames.length === 0) return;
    setMatchFrames(replayFrames);
    const { homeHex, awayHex } = resolveMatchKits(
      {
        colorPrimary: replayMatch?.challengerColorPrimary,
        colorSecondary: replayMatch?.challengerColorSecondary,
      },
      {
        colorPrimary: replayMatch?.opponentColorPrimary,
        colorSecondary: replayMatch?.opponentColorSecondary,
      }
    );
    canvasRef.current?.setTeamColors(homeHex, awayHex);
    // The ceremony rides the same load (story 7.10): the flag is consumed
    // atomically so a store re-emit cannot replay it. The walk phase is
    // armed by the engine's onIntroStart — the overlay rises exactly when
    // the walk begins (a frames load may still queue behind init).
    const withIntro = introEligibleRef.current;
    introEligibleRef.current = false;
    canvasRef.current?.loadFrames(replayFrames, { intro: withIntro });
  }, [replayFrames, replayMatch, setMatchFrames]);

  // Clear a pending celebration timer on unmount (interval or timeout id)
  // and drop the engine's kickoff pause (the canvas may already be gone)
  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current !== null) {
        window.clearInterval(celebrationTimerRef.current);
      }
      if (introTimerRef.current !== null) {
        window.clearInterval(introTimerRef.current);
      }
      canvasRef.current?.setKickoffPause(false);
    };
  }, []);

  // Test-only frame injection (story 3.7): lets E2E drive the full
  // frame -> sprites -> ball -> score pipeline on the viewer without a
  // real frames file. Seeds the replay store slice so the score pill,
  // timeline and drawer treat the injected frames like a real load.
  useEffect(() => {
    const handleTestLoadFrames = (event: Event) => {
      const detail = (event as CustomEvent<{ frames?: MatchFrame[] }>).detail;
      const frames = detail?.frames;
      if (!Array.isArray(frames) || frames.length === 0) return;
      useMatchStore.setState({ replayFrames: frames, replayError: null });
      setMatchFrames(frames);
      canvasRef.current?.loadFrames(frames);
    };
    window.addEventListener(TEST_LOAD_FRAMES_EVENT, handleTestLoadFrames);
    return () => window.removeEventListener(TEST_LOAD_FRAMES_EVENT, handleTestLoadFrames);
  }, [setMatchFrames]);

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

  // Goal scored (story 3.7 + 7.7): confetti/flash live in the Pixi engine.
  // Live goal (reached during playback): freeze the replay on the kickoff
  // frame — the engine bakes the reset into that same frame (teams in
  // place, conceding GK holding the ball) — raise the big score + 3-2-1
  // countdown, then resume. The engine's next onFrameChanged emission owns
  // the store's playing state both ways (pause lands inside applyFrame,
  // before its emission; resume re-emits on the next tick).
  // Seek/step onto a goal frame while paused: banner only, 1.5s.
  const handleGoalScored = useCallback((team: TeamId, scorerSlot: number | null, live: boolean) => {
    // A duplicate frames-load (React StrictMode double-effect in dev — the
    // E2E stack runs `npm run dev` — or a store re-emit) can re-apply the
    // goal frame while the first celebration's kickoff pause is still on:
    // the second callback then arrives non-live and would tear the running
    // countdown down to a 1.5s banner (overlay without countdown). An
    // active countdown owns the overlay; the seek/step paths cancel it
    // explicitly before any new goal can fire, so nothing is lost here.
    if (!live && celebrationTimerRef.current !== null) return;
    if (celebrationTimerRef.current !== null) {
      window.clearInterval(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
    }
    setCelebration({ team, scorerSlot, live });

    if (live) {
      canvasRef.current?.pause();
      canvasRef.current?.setKickoffPause(true);
      setScorePhase(true);
      setCountdown(CELEBRATION_COUNTDOWN_TICKS);
      const startedAt = Date.now();
      celebrationTimerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.ceil((CELEBRATION_TOTAL_MS - elapsed) / 1000);
        if (remaining > 0) {
          // The score card holds the first beat, then only the countdown
          if (elapsed >= CELEBRATION_SCORE_HOLD_MS) setScorePhase(false);
          setCountdown(Math.min(remaining, CELEBRATION_COUNTDOWN_TICKS));
          return;
        }
        if (celebrationTimerRef.current !== null) {
          window.clearInterval(celebrationTimerRef.current);
          celebrationTimerRef.current = null;
        }
        setCountdown(0);
        setCelebration(null);
        canvasRef.current?.setKickoffPause(false);
        canvasRef.current?.play();
      }, CELEBRATION_POLL_MS);
      return;
    }

    setScorePhase(true);
    setCountdown(0);
    celebrationTimerRef.current = window.setTimeout(() => {
      celebrationTimerRef.current = null;
      setCelebration(null);
    }, CELEBRATION_BANNER_MS);
  }, []);

  // User takes over (seek/step/play/pause/Space): drop the goal celebration
  // (story 7.7) AND the pre-match ceremony (story 7.10) — timers cleared,
  // kickoff pause lifted, never auto-resume from an old countdown. The
  // engine cancels its own intro walk inside the play/pause/seek call.
  const cancelOverlays = useCallback(() => {
    if (celebrationTimerRef.current !== null) {
      window.clearInterval(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
      setCelebration(null);
      setCountdown(0);
    }
    if (introPhaseRef.current !== null) {
      if (introTimerRef.current !== null) {
        window.clearInterval(introTimerRef.current);
        introTimerRef.current = null;
      }
      setIntroCountdown(0);
      applyIntroPhase(null);
    }
    canvasRef.current?.setKickoffPause(false);
  }, [applyIntroPhase]);

  // Walk started (story 7.10): the teams are on their way — raise the VS
  // card. The engine fires this when the walk actually begins, including
  // for a frames load that queued behind canvas init.
  const handleIntroStart = useCallback(() => {
    if (introPhaseRef.current === 'walk') return;
    applyIntroPhase('walk');
    setIntroCountdown(0);
  }, [applyIntroPhase]);

  // Walk finished (story 7.10): teams standing at their kickoff spots —
  // freeze the kickoff frame (ball at the keeper, pulsing ring) for the
  // 3-2-1 countdown, then playback starts. The engine's next onFrameChanged
  // emission owns the store's playing state, like the goal resume.
  const handleIntroComplete = useCallback(() => {
    if (introPhaseRef.current !== 'walk') return;
    canvasRef.current?.setKickoffPause(true);
    applyIntroPhase('countdown');
    setIntroCountdown(INTRO_COUNTDOWN_TICKS);
    const startedAt = Date.now();
    introTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.ceil((INTRO_TOTAL_MS - elapsed) / 1000);
      if (remaining > 0) {
        setIntroCountdown(Math.min(remaining, INTRO_COUNTDOWN_TICKS));
        return;
      }
      if (introTimerRef.current !== null) {
        window.clearInterval(introTimerRef.current);
        introTimerRef.current = null;
      }
      setIntroCountdown(0);
      applyIntroPhase(null);
      canvasRef.current?.setKickoffPause(false);
      canvasRef.current?.play();
    }, INTRO_POLL_MS);
  }, [applyIntroPhase]);

  // Skip affordance (story 7.10): a click on the ceremony overlay (or
  // Space) jumps straight to the kickoff — the engine's play() snaps the
  // walking teams to frame 0 and playback starts immediately
  const skipIntro = useCallback(() => {
    if (introPhaseRef.current === null) return;
    cancelOverlays();
    canvasRef.current?.play();
    const { currentFrame: frame, totalFrames: total } = useCanvasStore.getState();
    updatePlaybackState(true, frame, total);
  }, [cancelOverlays, updatePlaybackState]);

  /**
   * Pitch click (story 3.11): the selection -> log-filter semantics that
   * the workspace's debugger panel used, now driving the drawer.
   * - New player: select it and filter the logs to it — but only when it
   *   actually logged.
   * - Re-click on the selected player with logs: toggle the filter
   *   (highlight kept — deselection stays on empty pitch).
   * - Re-click without logs: deselect.
   */
  const handlePlayerSelected = useCallback(
    (playerId: string, _teamId: TeamId, _position: { x: number; y: number }, _scriptId: string | null) => {
      const canvas = useCanvasStore.getState();
      const wasSelected = canvas.selectedPlayerId === playerId;
      const hasLogs = useMatchStore
        .getState()
        .replayLogs.some((entry) => matchPlayerKey(entry.team, entry.slot) === playerId);

      if (wasSelected) {
        if (hasLogs) {
          const next = canvas.logFilterPlayerId === playerId ? null : playerId;
          canvas.setLogFilter(next);
          if (next) canvas.setSelectedPlayer(playerId);
        } else {
          canvas.setSelectedPlayer(null);
        }
        return;
      }

      canvas.setSelectedPlayer(playerId);
      canvas.setLogFilter(hasLogs ? playerId : null);
    },
    []
  );

  const handlePlayerDeselected = useCallback(() => {
    setSelectedPlayer(null);
    setLogFilter(null);
  }, [setSelectedPlayer, setLogFilter]);

  // Drawer chip / "Tous" (story 3.11): a chip filters AND selects its
  // player on the pitch; "Tous" clears the filter without deselecting
  const handleFilterPlayer = useCallback(
    (playerId: string | null) => {
      setLogFilter(playerId);
      if (playerId) setSelectedPlayer(playerId);
    },
    [setLogFilter, setSelectedPlayer]
  );

  const handleRetry = useCallback(() => {
    if (id) void loadReplay(id);
  }, [id, loadReplay]);

  // Playback controls, driven by the canvas handle
  const handlePlay = useCallback(() => {
    cancelOverlays();
    canvasRef.current?.play();
    updatePlaybackState(true, currentFrame, totalFrames);
  }, [cancelOverlays, updatePlaybackState, currentFrame, totalFrames]);

  const handlePause = useCallback(() => {
    cancelOverlays();
    canvasRef.current?.pause();
    updatePlaybackState(false, currentFrame, totalFrames);
  }, [cancelOverlays, updatePlaybackState, currentFrame, totalFrames]);

  const handleSeek = useCallback(
    (frame: number) => {
      cancelOverlays();
      canvasRef.current?.seekFrame(frame);
    },
    [cancelOverlays]
  );

  // Playback speed (story 7.7): the timeline owns the label and pushes each
  // change into the engine through this handle bridge
  const handleSpeedChange = useCallback((next: number) => {
    canvasRef.current?.setSpeed(next);
  }, []);

  // Space play/pause (story 3.8 AC #3): toggle only when the keystroke does
  // not belong to an editable surface or an activatable control
  const togglePlayback = useCallback(() => {
    // Space during the ceremony skips straight to the kickoff (story 7.10)
    if (introPhaseRef.current !== null) {
      skipIntro();
      return;
    }

    const { isPlaying: playing, currentFrame: frame, totalFrames: total } =
      useCanvasStore.getState();

    // Nothing loaded: no-op — toggling would set a phantom "playing" state
    if (total === 0) return;

    cancelOverlays();
    if (playing) {
      canvasRef.current?.pause();
      updatePlaybackState(false, frame, total);
    } else {
      canvasRef.current?.play();
      updatePlaybackState(true, frame, total);
    }
  }, [skipIntro, cancelOverlays, updatePlaybackState]);

  // Arrow navigation (story 3.9 AC #3/#4): ±1 tick per press, ±60 ticks
  // (1 second at the engine's 60 fps) with Shift. Stepping while playing
  // pauses first (video-player convention).
  const stepPlayback = useCallback(
    (direction: 'forward' | 'backward', ticks: number) => {
      // Arrows during the ceremony skip to the kickoff too — every takeover
      // key means "I want the match now" (story 7.10)
      if (introPhaseRef.current !== null) {
        skipIntro();
        return;
      }

      const { isPlaying: playing, currentFrame: frame, totalFrames: total } =
        useCanvasStore.getState();

      if (total === 0) return;

      cancelOverlays();
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
    [skipIntro, cancelOverlays, updatePlaybackState]
  );

  // Skip buttons (⏮/⏭): frame-by-frame step, not start/end jumps — the
  // same pause-then-step contract as the arrow keys
  const handleStep = useCallback((direction: 'forward' | 'backward') => {
    stepPlayback(direction, 1);
  }, [stepPlayback]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Arrow navigation (story 3.9): auto-repeat stays welcome (hold to
      // scrub) — only typing surfaces steal the keys
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Ctrl/Alt/Meta chords belong to the OS/browser — never hijack
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

  // Exit chip (story 7.7): back through history when there is one, else
  // the stade (/play) — a deep-linked viewer has nowhere to go back to
  const handleExit = useCallback(() => {
    const historyState = window.history.state as { idx?: number } | null;
    if (historyState && typeof historyState.idx === 'number' && historyState.idx > 0) {
      navigate(-1);
    } else {
      navigate('/play');
    }
  }, [navigate]);

  const score = useMemo(() => computeScore(replayFrames, currentFrame), [replayFrames, currentFrame]);
  const goalTicks = useMemo(() => extractGoalTicks(replayFrames), [replayFrames]);
  const goalEvents = useMemo(() => extractGoalEvents(replayFrames), [replayFrames]);
  const shotEvents = useMemo(() => extractFrameEvents(replayFrames, 'shot'), [replayFrames]);
  const replayReady = replayFrames.length > 0;

  // Team names (drawer parity, ReplayDrawer): the fighter tactic first —
  // owner usernames are the fallback (practice opponent = the bot)
  const challengerName =
    replayMatch?.challengerTacticName ?? replayMatch?.challengerName ?? 'Challenger';
  const opponentName =
    replayMatch?.opponentTacticName ?? replayMatch?.opponentName ?? 'Opponent';
  // Team kits (drawer parity, ReplayDrawer): challenger wears home,
  // opponent away — a null match keeps the default palette
  const { homeHex, awayHex } = resolveMatchKits(
    {
      colorPrimary: replayMatch?.challengerColorPrimary,
      colorSecondary: replayMatch?.challengerColorSecondary,
    },
    {
      colorPrimary: replayMatch?.opponentColorPrimary,
      colorSecondary: replayMatch?.opponentColorSecondary,
    }
  );

  const handleDrawerSeek = useCallback(
    (frame: number) => {
      // Same takeover contract as the scrubber/step/play paths: a drawer
      // seek during the live-goal countdown cancels the overlay and its
      // auto-resume timer
      cancelOverlays();
      canvasRef.current?.seekFrame(frame);
    },
    [cancelOverlays]
  );

  return (
    <div style={styles.page}>
      <Appbar />

      <div style={styles.stage}>
        <div style={styles.pitchPanel}>
          <TacticsCanvas
            ref={canvasRef}
            onPlayerSelected={handlePlayerSelected}
            onPlayerDeselected={handlePlayerDeselected}
            onFrameChanged={handleFrameChanged}
            onGoalScored={handleGoalScored}
            onIntroStart={handleIntroStart}
            onIntroComplete={handleIntroComplete}
          />

          {/* Exit chip */}
          <button
            type="button"
            data-testid="match-exit-button"
            onClick={handleExit}
            style={styles.exitChip}
          >
            Quitter
          </button>

          {/* Pre-match ceremony (story 7.10): the two teams walk onto the
              pitch from their sideline under the VS card, then the 3-2-1
              countdown — no score anywhere, nothing is 0-0 yet. A click
              anywhere skips straight to the kickoff. zIndex below the exit
              chip keeps "Quitter" reachable during the ceremony. The
              isPlaying guard is the rogue-load escape hatch: a duplicate
              frames-load without the ceremony flag (store re-emit) starts
              playback and the overlay must not hang over a live match. */}
          {introPhase && replayReady && !isPlaying && (
            <div
              data-testid="match-intro-overlay"
              role="status"
              aria-live="polite"
              onClick={skipIntro}
              style={styles.intro}
            >
              {introPhase === 'walk' ? (
                <div className="lachatadede-goal-overlay" style={styles.introCard}>
                  <span style={{ ...styles.introTeam, color: homeHex }}>{challengerName}</span>
                  <span style={styles.introVs}>VS</span>
                  <span style={{ ...styles.introTeam, color: awayHex }}>{opponentName}</span>
                </div>
              ) : (
                introCountdown > 0 && (
                  <span
                    data-testid="match-intro-countdown"
                    className="lachatadede-goal-overlay"
                    style={styles.countdownSolo}
                    aria-hidden="true"
                  >
                    {introCountdown}
                  </span>
                )
              )}
            </div>
          )}

          {/* Broadcast score pill (story 7.7 AC #1): names in their colors,
              live score, minute, frame counter in mono — hidden during the
              pre-match ceremony (story 7.10): no 0-0 on screen */}
          {replayReady && introPhase === null && (
            <div data-testid="score-display" style={styles.scorePill}>
              <span style={{ ...styles.scoreTeam, color: homeHex }}>{challengerName}</span>
              <span style={styles.scoreValue}>
                {score.challenger} — {score.opponent}
              </span>
              <span style={{ ...styles.scoreTeam, color: awayHex }}>{opponentName}</span>
              <span style={styles.scoreMinute}>{formatTime(currentFrame)}</span>
              <span style={styles.scoreFrame} data-testid="pill-frame-counter">
                F{currentFrame}/{totalFrames}
              </span>
            </div>
          )}

          {/* Goal celebration overlay (story 7.7 AC #3): the full-pitch
              container centers the content — the pop animation (scale
              keyframes) rides on the card, not the positioning. Live goal:
              the score card holds the first beat, then only the countdown
              remains until playback resumes. */}
          {celebration && replayReady && (
            <div
              data-testid="goal-celebration-overlay"
              role="status"
              aria-live="polite"
              style={styles.celebration}
            >
              {scorePhase ? (
                <div className="lachatadede-goal-overlay" style={styles.celebrationCard}>
                  <span style={styles.celebrationTitle}>BUUUT&nbsp;!</span>
                  <span style={styles.celebrationScorer}>
                    {celebration.scorerSlot !== null ? `#${celebration.scorerSlot}` : 'csc'} ·{' '}
                    {celebration.team === 'home' ? challengerName : opponentName}
                  </span>
                  <span style={styles.celebrationScoreRow}>
                    <span style={{ ...styles.celebrationTeam, color: homeHex }}>
                      {challengerName}
                    </span>
                    <span style={styles.celebrationScore}>
                      {score.challenger} — {score.opponent}
                    </span>
                    <span style={{ ...styles.celebrationTeam, color: awayHex }}>
                      {opponentName}
                    </span>
                  </span>
                  {countdown > 0 && (
                    <span
                      data-testid="goal-countdown"
                      style={styles.celebrationCountdown}
                      aria-hidden="true"
                    >
                      {countdown}
                    </span>
                  )}
                </div>
              ) : (
                countdown > 0 && (
                  <span
                    data-testid="goal-countdown"
                    className="lachatadede-goal-overlay"
                    style={styles.countdownSolo}
                    aria-hidden="true"
                  >
                    {countdown}
                  </span>
                )
              )}
            </div>
          )}

          {/* Replay loading */}
          {isReplayLoading && (
            <div
              data-testid="replay-loading-overlay"
              role="status"
              aria-live="polite"
              aria-busy="true"
              style={styles.overlay}
            >
              <div style={styles.overlayContent}>
                <span style={styles.spinner} aria-hidden="true" />
                <span style={styles.overlayText}>Chargement du match...</span>
                <button
                  type="button"
                  data-testid="replay-cancel-button"
                  onClick={cancelReplayLoad}
                  style={styles.ghostButton}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Replay load failure: friendly state + retry */}
          {replayError && (
            <div data-testid="replay-error-overlay" role="alert" style={styles.overlay}>
              <div style={styles.overlayContent}>
                <span data-testid="replay-error-message" style={styles.overlayText}>
                  {replayError}
                </span>
                <button
                  type="button"
                  data-testid="replay-retry-button"
                  onClick={handleRetry}
                  style={styles.primaryButton}
                >
                  Réessayer
                </button>
                <button
                  type="button"
                  data-testid="replay-error-back-button"
                  onClick={handleExit}
                  style={styles.ghostButton}
                >
                  Retour au stade
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right stats/logs drawer (stories 7.7 + 7.9, S1 design) — only once
            a replay is actually loaded: loading/error states own the pitch */}
        {replayReady && (
          <ReplayDrawer
            match={replayMatch}
            score={score}
            goalEvents={goalEvents}
            shotEvents={shotEvents}
            logs={replayLogs}
            stats={replayStats}
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            filterPlayerId={logFilterPlayerId}
            onFilterPlayer={handleFilterPlayer}
            onSeekFrame={handleDrawerSeek}
          />
        )}
      </div>

      {/* Broadcast timeline (story 7.7): skip, speed, scrubber, counter */}
      {replayReady && (
        <Timeline
          isPlaying={isPlaying}
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          goalTicks={goalTicks}
          onSpeedChange={handleSpeedChange}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          onStep={handleStep}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
  },
  stage: {
    flex: 1,
    display: 'flex',
    gap: 8,
    minHeight: 0,
    padding: 8,
  },
  pitchPanel: {
    flex: 1,
    position: 'relative',
    borderRadius: 'var(--r)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow)',
  },
  exitChip: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 6,
    background: 'rgba(10, 20, 14, 0.6)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 12,
    padding: '7px 13px',
    borderRadius: 11,
    backdropFilter: 'blur(4px)',
  },
  intro: {
    position: 'absolute',
    inset: 0,
    zIndex: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  introCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 22,
    padding: '20px 42px',
    borderRadius: 'var(--r-modal)',
    background: 'rgba(10, 20, 14, 0.72)',
    backdropFilter: 'blur(6px)',
    boxShadow: 'var(--shadow-lg)',
    color: '#fff',
    animation: 'lachatadede-goal-pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) both',
  },
  introTeam: {
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '0.03em',
    textShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
    whiteSpace: 'nowrap',
  },
  introVs: {
    fontFamily: 'var(--mono)',
    fontSize: 17,
    fontWeight: 800,
    color: 'var(--sun)',
  },
  scorePill: {
    position: 'absolute',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    background: 'rgba(10, 20, 14, 0.6)',
    color: '#fff',
    padding: '8px 18px',
    borderRadius: 14,
    fontWeight: 800,
    fontSize: 13,
    backdropFilter: 'blur(5px)',
    boxShadow: 'var(--shadow-lg)',
    whiteSpace: 'nowrap',
  },
  scoreTeam: {
    fontWeight: 800,
  },
  scoreValue: {
    fontSize: 17,
    color: 'var(--sun)',
  },
  scoreMinute: {
    fontFamily: 'var(--mono)',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    borderLeft: '1px solid rgba(255, 255, 255, 0.25)',
    paddingLeft: 11,
  },
  scoreFrame: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  celebration: {
    position: 'absolute',
    inset: 0,
    zIndex: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  celebrationCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: '22px 44px',
    borderRadius: 'var(--r-modal)',
    background: 'rgba(10, 20, 14, 0.72)',
    backdropFilter: 'blur(6px)',
    boxShadow: 'var(--shadow-lg)',
    color: '#fff',
    animation: 'lachatadede-goal-pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) both',
  },
  celebrationTitle: {
    fontSize: 34,
    fontWeight: 800,
    letterSpacing: '0.06em',
    color: 'var(--sun)',
    textShadow: '0 2px 12px rgba(0, 0, 0, 0.45)',
  },
  celebrationScorer: {
    fontSize: 15,
    fontWeight: 700,
  },
  celebrationScoreRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 18,
    marginTop: 4,
  },
  celebrationTeam: {
    fontSize: 17,
    fontWeight: 800,
    textShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
  },
  celebrationScore: {
    fontFamily: 'var(--mono)',
    fontSize: 58,
    fontWeight: 800,
    lineHeight: 1,
    color: '#fff',
    textShadow: '0 3px 18px rgba(0, 0, 0, 0.5)',
  },
  celebrationCountdown: {
    marginTop: 6,
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: '2px solid rgba(255, 255, 255, 0.35)',
    fontFamily: 'var(--mono)',
    fontSize: 22,
    fontWeight: 800,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  countdownSolo: {
    width: 96,
    height: 96,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: 'rgba(10, 20, 14, 0.6)',
    backdropFilter: 'blur(4px)',
    border: '2px solid rgba(255, 255, 255, 0.4)',
    fontFamily: 'var(--mono)',
    fontSize: 44,
    fontWeight: 800,
    color: '#fff',
    textShadow: '0 2px 12px rgba(0, 0, 0, 0.45)',
    animation: 'lachatadede-goal-pop 0.3s cubic-bezier(0.2, 1.4, 0.4, 1) both',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    background: 'rgba(10, 20, 14, 0.55)',
    backdropFilter: 'blur(3px)',
  },
  overlayContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  spinner: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    border: '4px solid rgba(255, 255, 255, 0.25)',
    borderTopColor: 'var(--sun)',
    animation: 'lachatadede-spin 1s linear infinite',
  },
  overlayText: {
    fontSize: 16,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '0.04em',
  },
  primaryButton: {
    padding: '9px 16px',
    borderRadius: 'var(--r-btn)',
    fontWeight: 700,
    fontSize: 13,
    background: 'var(--corail)',
    color: '#fff',
    boxShadow: '0 4px 14px rgba(255, 107, 87, 0.35)',
  },
  ghostButton: {
    padding: '9px 16px',
    borderRadius: 'var(--r-btn)',
    fontWeight: 700,
    fontSize: 13,
    background: 'rgba(255, 255, 255, 0.12)',
    color: '#fff',
  },
};
