/**
 * MatchStatusOverlay - Practice match feedback states (story 3.5)
 * OWNER: Dev Team
 *
 * - Simulating: full-screen blocker while the synchronous simulation runs.
 *   Deliberately minimal (no animated spinner — deferred-work.md anti-pattern)
 *   and NOT dismissible: the server-side work continues regardless, so
 *   Escape/click-away must not pretend to cancel it.
 * - Result: score banner with a Watch Replay button (frame loading is story 3.8).
 * - Error: message with a Retry button; the overlay is dismissed.
 */

import type { MatchResult } from '@/types';

interface MatchStatusOverlayProps {
  isSimulating: boolean;
  match: MatchResult | null;
  error: string | null;
  /** Restart the simulation after a failure */
  onRetry: () => void;
}

export const MatchStatusOverlay: React.FC<MatchStatusOverlayProps> = ({
  isSimulating,
  match,
  error,
  onRetry,
}) => {
  if (isSimulating) {
    return (
      <div style={styles.backdrop} data-testid="simulating-overlay">
        <div style={styles.panel}>
          <span style={styles.title}>Simulating...</span>
          <span style={styles.hint}>Your AI is playing against the Easy Bot</span>
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
        <button type="button" style={styles.button} data-testid="watch-replay-button">
          Watch Replay
        </button>
      </div>
    );
  }

  return null;
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.75)',
    zIndex: 2000,
    cursor: 'wait',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px 32px',
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '8px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  hint: {
    fontSize: '12px',
    color: '#9d9d9d',
  },
  toast: {
    position: 'fixed',
    top: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '10px 20px',
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    zIndex: 1500,
  },
  score: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
  },
  errorText: {
    fontSize: '13px',
    color: '#f48771',
  },
  button: {
    padding: '6px 16px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
};
