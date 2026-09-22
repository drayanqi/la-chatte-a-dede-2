/**
 * Timeline - Contrôles de lecture et barre de progression (scrubber)
 * PROPRIÉTAIRE: Winston (Software Architect)
 *
 * Story 7.7: the broadcast timeline (La Ronde tokens) — frame-step buttons
 * (⏮/⏭ step one frame, not start/end jumps), speed cycling (0.5x/1x/2x/4x),
 * sun goal ticks clickable to seek, mono frame counter. Scrubbing behavior
 * from story 3.9 (pointer capture, one seek per animation frame, ARIA
 * slider) is kept as-is.
 *
 * Display convention (review 2026-09-15, Pelo): elapsed time — position
 * shows (tick + 1) / 60 so scrubbing to the last frame reads 03:00 / 03:00.
 * Scrubbing pauses playback (video-player convention, like arrow stepping).
 */

import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/lib/timeFormat';
import { teamIdFromMatchTeam } from '@/lib/teamMapping';
import type { MatchTeam } from '@/types';

/** One goal position on the scrubber track, precomputed per replay load */
export interface GoalTickMarker {
  tick: number;
  team: MatchTeam;
}

/** Shipped playback speeds, in cycle order (story 7.7) */
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;

interface TimelineProps {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  goalTicks: GoalTickMarker[];
  /** Speed changes reach the engine through the page's canvas handle */
  onSpeedChange: (speed: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (frame: number) => void;
  /** Frame-step buttons: ±1 tick with the pause-then-step contract */
  onStep: (direction: 'forward' | 'backward') => void;
}

/** Sun goal ticks (S1 mockup): every goal marks the track, color-coded by team is deferred */

export const Timeline: React.FC<TimelineProps> = ({
  isPlaying,
  currentFrame,
  totalFrames,
  goalTicks,
  onSpeedChange,
  onPlay,
  onPause,
  onSeek,
  onStep,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pendingClientXRef = useRef<number | null>(null);
  const seekRafRef = useRef<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  // Playback speed (story 7.7): local label + engine multiplier pushed up.
  // The component remounts with each replay (the page drops its replay on
  // unmount), so every match starts back at 1x.
  const [speed, setSpeed] = useState<number>(1);

  const maxFrame = Math.max(0, totalFrames - 1);
  // Elapsed-time position: (tick + 1) / total so the last frame lands at 100%
  const progress = totalFrames > 0 ? ((currentFrame + 1) / totalFrames) * 100 : 0;

  // Cancel a pending coalesced seek on unmount
  useEffect(() => {
    return () => {
      if (seekRafRef.current !== null) {
        window.cancelAnimationFrame(seekRafRef.current);
      }
    };
  }, []);

  const flushSeek = () => {
    seekRafRef.current = null;
    const clientX = pendingClientXRef.current;
    if (clientX === null || !trackRef.current) return;
    pendingClientXRef.current = null;

    const rect = trackRef.current.getBoundingClientRect();
    const percent = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const frame = Math.min(Math.max(0, Math.floor(percent * totalFrames)), maxFrame);
    onSeek(frame);
  };

  /** Single seek path for click-to-seek and dragging (story 3.9 Task 1) */
  const seekFromClientX = (clientX: number) => {
    // Coalesce pointermove bursts to one seek per animation frame: the
    // newest position always wins, the engine is never flooded, no frame
    // render is skipped (UX spec: throttle by rAF, never skip renders)
    pendingClientXRef.current = clientX;
    if (seekRafRef.current === null) {
      seekRafRef.current = window.requestAnimationFrame(flushSeek);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (totalFrames === 0) return;
    // Primary button / first contact only: right-click-drag must not scrub
    if (e.button !== 0 || !e.isPrimary) return;
    // Single-drag contract: a second pointer never steals the active drag
    if (isDraggingRef.current) return;
    isDraggingRef.current = true;
    activePointerIdRef.current = e.pointerId;
    // Capture on the track: moves outside the bar keep scrubbing
    e.currentTarget.setPointerCapture(e.pointerId);
    // Scrubbing pauses playback (video-player convention, like arrow
    // stepping) — otherwise the game loop fights the drag every frame
    if (isPlaying) onPause();
    seekFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || e.pointerId !== activePointerIdRef.current) return;
    seekFromClientX(e.clientX);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || e.pointerId !== activePointerIdRef.current) return;
    isDraggingRef.current = false;
    activePointerIdRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    // The release position must win: seek to the pointerup coordinates now —
    // pending pointermove positions are superseded by the release point
    pendingClientXRef.current = e.clientX;
    if (seekRafRef.current !== null) {
      window.cancelAnimationFrame(seekRafRef.current);
    }
    flushSeek();
  };

  // Slider keyboard support: Home/End. Arrows are NOT handled here — the
  // page-level handler owns them (stepping + preventDefault), so handling
  // them here too would double-step while the slider has focus.
  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (totalFrames === 0) return;
    if (e.key === 'Home') {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSeek(maxFrame);
    }
  };

  // A goal tick button must not trigger the track's scrub (its pointerdown
  // would start a drag session and swallow the click)
  const stopTrackPointer = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <div style={styles.container}>
      {/* Frame step back / play / frame step forward */}
      <div style={styles.controls}>
        <button
          type="button"
          style={styles.tpbtn}
          data-testid="step-back-button"
          aria-label="Reculer d'une frame"
          title="Frame précédente"
          disabled={totalFrames === 0 || currentFrame === 0}
          onClick={() => onStep('backward')}
        >
          ◂
        </button>

        <button
          type="button"
          style={styles.playButton}
          data-testid="play-pause-button"
          aria-label={isPlaying ? 'Mettre en pause' : 'Lire le replay'}
          onClick={isPlaying ? onPause : onPlay}
          disabled={totalFrames === 0}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          type="button"
          style={styles.tpbtn}
          data-testid="step-forward-button"
          aria-label="Avancer d'une frame"
          title="Frame suivante"
          disabled={totalFrames === 0 || currentFrame >= maxFrame}
          onClick={() => onStep('forward')}
        >
          ▸
        </button>
      </div>

      {/* Time display: mm:ss / mm:ss (story 3.9 AC #1) */}
      <div style={styles.timeDisplay} data-testid="timeline-time-display">
        <span>{formatTime(currentFrame + 1)}</span>
        <span style={styles.timeSeparator}> / </span>
        <span style={styles.totalTime}>{formatTime(totalFrames)}</span>
      </div>

      {/* Scrubber: ARIA slider + drag handle + clickable sun goal ticks */}
      <div
        ref={trackRef}
        data-testid="timeline-track"
        role="slider"
        tabIndex={totalFrames > 0 ? 0 : -1}
        aria-label="Replay timeline"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={maxFrame}
        aria-valuenow={Math.min(currentFrame, maxFrame)}
        aria-valuetext={`${formatTime(currentFrame + 1)} of ${formatTime(totalFrames)}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleSliderKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{ ...styles.progressContainer, ...(isFocused ? styles.focusRing : {}) }}
      >
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          {goalTicks.map((goal, i) => (
            <button
              key={`${goal.tick}-${i}`}
              type="button"
              data-testid={`goal-marker-${i}`}
              aria-label={`But ${teamIdFromMatchTeam(goal.team) === 'home' ? 'domicile' : 'extérieur'} — revenir à ${formatTime(goal.tick)}`}
              onPointerDown={stopTrackPointer}
              onClick={() => onSeek(goal.tick)}
              style={{
                ...styles.goalMarker,
                left: `${totalFrames > 0 ? ((goal.tick + 1) / totalFrames) * 100 : 0}%`,
              }}
            />
          ))}
          <div
            data-testid="timeline-handle"
            style={{ ...styles.progressHandle, left: `${progress}%` }}
          />
        </div>
      </div>

      {/* Speed cycle (story 7.7): 0.5x → 1x → 2x → 4x → 0.5x */}
      <button
        type="button"
        style={styles.speedButton}
        data-testid="speed-button"
        aria-label={`Vitesse de lecture : ${speed}x — cliquer pour changer`}
        onClick={() => {
          const index = PLAYBACK_SPEEDS.findIndex((value) => value === speed);
          const next = PLAYBACK_SPEEDS[(index + 1) % PLAYBACK_SPEEDS.length] ?? 1;
          setSpeed(next);
          onSpeedChange(next);
        }}
        disabled={totalFrames === 0}
      >
        {speed.toString().replace('.', ',')}×
      </button>

      {/* Frame counter */}
      <div style={styles.frameCounter} data-testid="frame-counter">
        Frame: {currentFrame} / {totalFrames}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    height: '54px',
    padding: '0 14px',
    backgroundColor: 'var(--panel)',
    borderTop: '1px solid var(--line)',
    boxShadow: 'var(--shadow)',
    gap: '14px',
    flex: 'none',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  tpbtn: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--panel2)',
    color: 'var(--ink)',
    border: 'none',
    borderRadius: 'var(--r-btn)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    cursor: 'pointer',
    fontSize: '13px',
  },
  playButton: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--corail)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '15px',
    boxShadow: '0 4px 14px rgba(255, 107, 87, 0.35)',
  },
  timeDisplay: {
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--ink)',
    whiteSpace: 'nowrap',
  },
  timeSeparator: {
    color: 'var(--muted)',
  },
  totalTime: {
    color: 'var(--muted)',
  },
  progressContainer: {
    flex: 1,
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    touchAction: 'none',
    userSelect: 'none',
  },
  focusRing: {
    outline: '2px solid var(--corail)',
    outlineOffset: '2px',
  },
  progressTrack: {
    position: 'relative',
    width: '100%',
    height: '9px',
    backgroundColor: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    borderRadius: '5px',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: 'var(--corail)',
    borderRadius: '5px',
  },
  goalMarker: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '15px',
    height: '15px',
    borderRadius: '50%',
    backgroundColor: 'var(--sun)',
    border: '2px solid var(--panel)',
    boxShadow: '0 1px 4px rgba(18, 36, 27, 0.3)',
    padding: 0,
    cursor: 'pointer',
    zIndex: 2,
  },
  progressHandle: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '14px',
    height: '14px',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
    border: '2px solid var(--corail)',
    boxShadow: '0 1px 3px rgba(18, 36, 27, 0.3)',
    zIndex: 3,
    pointerEvents: 'none',
  },
  speedButton: {
    minWidth: '44px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--panel2)',
    color: 'var(--ink)',
    border: 'none',
    borderRadius: 'var(--r-btn)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    cursor: 'pointer',
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    fontWeight: 700,
    flex: 'none',
  },
  frameCounter: {
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    color: 'var(--muted)',
    minWidth: '128px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
};
