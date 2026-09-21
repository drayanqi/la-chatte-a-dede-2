/**
 * MatchPage - The broadcast replay route (story 7.2 shell)
 *
 * Deep-linkable /match/:id viewer: loads the match's frames on mount
 * (refresh-safe), renders the pitch with a minimal score readout and a
 * exit chip. The full broadcast anatomy (score pill with team colors,
 * video-editor timeline, logs/stats drawer, celebration overlay) lands
 * in story 7.7.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TacticsCanvas, TacticsCanvasHandle } from '@/components/canvas';
import { Appbar } from '@/components/layout/Appbar';
import { Timeline } from '@/components/layout/Timeline';
import { useCanvasStore } from '@/stores/canvasStore';
import { useMatchStore } from '@/stores/matchStore';
import { PLAYER_AWAY_HEX, PLAYER_HOME_HEX, resolveAwayTeamHex } from '@/lib/teamColors';
import { computeScore, extractGoalTicks } from '@/lib/score';
import type { PlayerFrameState } from '@/types';

export const MatchPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<TacticsCanvasHandle>(null);

  const {
    replayFrames,
    replayMatch,
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
    updatePlaybackState,
    updatePlayerStates,
    setMatchFrames,
    setSelectedPlayer,
  } = useCanvasStore();

  // Load the requested replay once (refresh-safe deep link): a mismatched
  // or absent match triggers the load, an in-flight one is left alone.
  // Deliberately keyed on the route id only — the store guards
  // (isReplayLoading / replayMatch) are read at run time.
  useEffect(() => {
    if (!id) return;
    if (useMatchStore.getState().isReplayLoading) return;
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
    };
  }, [cancelReplayLoad, clearReplay, setMatchFrames, updatePlaybackState, updatePlayerStates, setSelectedPlayer]);

  // Hand a freshly loaded replay to the engine (autoplay starts inside
  // loadFrames) and mirror it into the score slice. Team colors of the
  // replayed match (story 7.4): challenger paints home, opponent away —
  // a practice opponent keeps the default palette. The away side is
  // resolved against home (story 7.6 feedback): two teams with the same
  // color would paint all 10 players identically.
  useEffect(() => {
    if (replayFrames.length === 0) return;
    setMatchFrames(replayFrames);
    const homeHex = replayMatch?.challengerColorPrimary ?? PLAYER_HOME_HEX;
    const awayHex = resolveAwayTeamHex(
      homeHex,
      replayMatch?.opponentColorPrimary ?? PLAYER_AWAY_HEX
    );
    canvasRef.current?.setTeamColors(homeHex, awayHex);
    canvasRef.current?.loadFrames(replayFrames);
  }, [replayFrames, replayMatch, setMatchFrames]);

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

  const handlePlayerSelected = useCallback((playerId: string) => {
    setSelectedPlayer(playerId);
  }, [setSelectedPlayer]);

  const handlePlayerDeselected = useCallback(() => {
    setSelectedPlayer(null);
  }, [setSelectedPlayer]);

  const handleRetry = useCallback(() => {
    if (id) void loadReplay(id);
  }, [id, loadReplay]);

  // Playback controls (interim until the 7.7 broadcast timeline): the same
  // wiring the workspace replay path uses, driven by the canvas handle.
  const handlePlay = useCallback(() => {
    canvasRef.current?.play();
    updatePlaybackState(true, currentFrame, totalFrames);
  }, [updatePlaybackState, currentFrame, totalFrames]);

  const handlePause = useCallback(() => {
    canvasRef.current?.pause();
    updatePlaybackState(false, currentFrame, totalFrames);
  }, [updatePlaybackState, currentFrame, totalFrames]);

  const handleStep = useCallback((direction: 'forward' | 'backward') => {
    canvasRef.current?.step(direction);
  }, []);

  const handleSeek = useCallback((frame: number) => {
    canvasRef.current?.seekFrame(frame);
  }, []);

  const handleExit = useCallback(() => {
    navigate('/play');
  }, [navigate]);

  const score = useMemo(() => computeScore(replayFrames, currentFrame), [replayFrames, currentFrame]);
  const goalTicks = useMemo(() => extractGoalTicks(replayFrames), [replayFrames]);
  const replayReady = replayFrames.length > 0;

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

          {/* Score readout (broadcast score pill lands in 7.7) */}
          {replayReady && (
            <div data-testid="score-display" style={styles.scorePill}>
              <span>{replayMatch?.challengerName ?? 'Challenger'}</span>
              <span style={styles.scoreValue}>
                {score.challenger} — {score.opponent}
              </span>
              <span>{replayMatch?.opponentName ?? 'Opponent'}</span>
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
      </div>

      {/* Replay controls (interim wiring until the 7.7 broadcast timeline) */}
      {replayReady && (
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
  page: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
  },
  stage: {
    flex: 1,
    display: 'flex',
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
  },
  scoreValue: {
    fontSize: 17,
    color: 'var(--sun)',
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
