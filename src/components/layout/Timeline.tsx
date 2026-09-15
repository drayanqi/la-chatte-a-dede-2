/**
 * Timeline - Contrôles de lecture et barre de progression (scrubber)
 * PROPRIÉTAIRE: Winston (Software Architect)
 *
 * Story 3.9: continuous drag scrubbing (pointer capture, one seek per
 * animation frame), mm:ss time display, ARIA slider and goal markers.
 * Click-to-seek and drag share a single seekFromClientX path.
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

interface TimelineProps {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  goalTicks: GoalTickMarker[];
  onPlay: () => void;
  onPause: () => void;
  onStep: (direction: 'forward' | 'backward') => void;
  onSeek: (frame: number) => void;
}

/** Team colors (UX spec, Rocket League-inspired) — same hex as the engine's Player.ts */
const TEAM_COLORS: Record<'home' | 'away', string> = {
  home: '#ff6b1a',
  away: '#1a8cff',
};

export const Timeline: React.FC<TimelineProps> = ({
  isPlaying,
  currentFrame,
  totalFrames,
  goalTicks,
  onPlay,
  onPause,
  onStep,
  onSeek,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pendingClientXRef = useRef<number | null>(null);
  const seekRafRef = useRef<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);

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
  // global handler in AppShell owns them (stepping + preventDefault), so
  // handling them here too would double-step while the slider has focus.
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

  return (
    <div style={styles.container}>
      {/* Contrôles */}
      <div style={styles.controls}>
        <button
          style={styles.controlButton}
          onClick={() => onStep('backward')}
          disabled={currentFrame === 0}
        >
          ⏮
        </button>

        <button
          style={styles.playButton}
          data-testid="play-pause-button"
          onClick={isPlaying ? onPause : onPlay}
          disabled={totalFrames === 0}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          style={styles.controlButton}
          onClick={() => onStep('forward')}
          disabled={currentFrame >= totalFrames - 1}
        >
          ⏭
        </button>
      </div>

      {/* Time display: mm:ss / mm:ss (story 3.9 AC #1) */}
      <div style={styles.timeDisplay} data-testid="timeline-time-display">
        <span>{formatTime(currentFrame + 1)}</span>
        <span style={styles.timeSeparator}> / </span>
        <span style={styles.totalTime}>{formatTime(totalFrames)}</span>
      </div>

      {/* Scrubber: ARIA slider + drag handle + goal markers */}
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
            <div
              key={`${goal.tick}-${i}`}
              data-testid={`goal-marker-${i}`}
              style={{
                ...styles.goalMarker,
                left: `${totalFrames > 0 ? ((goal.tick + 1) / totalFrames) * 100 : 0}%`,
                backgroundColor: TEAM_COLORS[teamIdFromMatchTeam(goal.team)],
              }}
            />
          ))}
          <div
            data-testid="timeline-handle"
            style={{ ...styles.progressHandle, left: `${progress}%` }}
          />
        </div>
      </div>

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
    height: '48px',
    padding: '0 16px',
    backgroundColor: '#2d2d2d',
    borderTop: '1px solid #3c3c3c',
    gap: '16px',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  controlButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    color: '#cccccc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  playButton: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
  },
  timeDisplay: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#cccccc',
    whiteSpace: 'nowrap',
  },
  timeSeparator: {
    color: '#666666',
  },
  totalTime: {
    color: '#888888',
  },
  progressContainer: {
    flex: 1,
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    touchAction: 'none',
    userSelect: 'none',
  },
  focusRing: {
    outline: '2px solid #0e639c',
    outlineOffset: '2px',
  },
  progressTrack: {
    position: 'relative',
    width: '100%',
    height: '4px',
    backgroundColor: '#3c3c3c',
    borderRadius: '2px',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#0e639c',
    borderRadius: '2px',
  },
  goalMarker: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '3px',
    height: '10px',
    borderRadius: '1px',
    pointerEvents: 'none',
    zIndex: 2,
  },
  progressHandle: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '12px',
    height: '12px',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    zIndex: 3,
  },
  frameCounter: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#666666',
    minWidth: '120px',
    textAlign: 'right',
  },
};
