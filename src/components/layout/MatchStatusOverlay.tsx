/**
 * MatchStatusOverlay - Practice match feedback states (story 3.5, 7.5 restyle)
 * OWNER: Dev Team
 *
 * - Simulating: pitch-covering blocker while the synchronous simulation runs
 *   (spinner + frames-estimate chip, mockup s-equipes). NOT dismissible: the
 *   server-side work continues regardless, so Escape/click-away must not
 *   pretend to cancel it.
 * - Result: score banner with a Watch Replay button (story 3.8, AC #1; 7.5
 *   hands off to the /match/:id viewer).
 * - Error: message with a Retry button; the overlay is dismissed.
 *
 * All states are absolutely positioned: the overlay renders INSIDE the pitch
 * panel (story 7.5 layout), never over the side panels.
 */

import type { MatchResult } from '@/types';

/** Engine match length (3 min at 60 fps) — the frames-estimate chip (7.5) */
const ESTIMATED_FRAMES = 10800;

interface MatchStatusOverlayProps {
  isSimulating: boolean;
  match: MatchResult | null;
  error: string | null;
  /** Restart the simulation after a failure */
  onRetry: () => void;
  /** Load and play the finished match's replay (story 3.8, AC #1) */
  onWatchReplay?: () => void;
}

export const MatchStatusOverlay: React.FC<MatchStatusOverlayProps> = ({
  isSimulating,
  match,
  error,
  onRetry,
  onWatchReplay,
}) => {
  if (isSimulating) {
    return (
      <div style={styles.backdrop} data-testid="simulating-overlay">
        <div style={styles.panel}>
          <span style={styles.spinner} aria-hidden="true" />
          <span style={styles.title}>Simulating...</span>
          <span style={styles.hint}>Your AI is playing against the Easy Bot</span>
          <span style={styles.framesChip}>
            ≈ {ESTIMATED_FRAMES.toLocaleString('en-US')} frames · a few seconds
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.toast} data-testid="match-error-banner">
        <span style={styles.errorText} data-testid="match-error-message">
          {error}
        </span>
        <button type="button" style={styles.button} data-testid="retry-match-button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (match) {
    return (
      <div style={styles.toast} data-testid="match-result-banner">
        <span style={styles.score} data-testid="match-result-score">
          You {match.scoreChallenger} — {match.scoreOpponent} Easy Bot
        </span>
        <button
          type="button"
          style={styles.button}
          data-testid="watch-replay-button"
          onClick={onWatchReplay}
        >
          Watch Replay
        </button>
      </div>
    );
  }

  return null;
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 20, 14, 0.55)',
    zIndex: 30,
    cursor: 'wait',
    backdropFilter: 'blur(3px)',
  },
  spinner: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    border: '4px solid rgba(255, 255, 255, 0.25)',
    borderTopColor: 'var(--mint)',
    animation: 'lachatadede-spin 0.9s linear infinite',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px 32px',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-modal, 24px)',
    boxShadow: 'var(--shadow-lg)',
  },
  title: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--ink)',
  },
  hint: {
    fontSize: '12px',
    color: 'var(--muted)',
  },
  framesChip: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--ink)',
    background: 'var(--panel2)',
    border: '1px solid var(--line)',
    borderRadius: '999px',
    padding: '4px 12px',
  },
  toast: {
    position: 'absolute',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '10px 20px',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-btn, 13px)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 30,
  },
  score: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--ink)',
  },
  errorText: {
    fontSize: '13px',
    color: 'var(--corail)',
  },
  button: {
    padding: '8px 16px',
    backgroundColor: 'var(--corail)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--r-btn, 13px)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
};
