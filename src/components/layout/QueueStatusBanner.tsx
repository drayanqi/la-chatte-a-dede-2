/**
 * QueueStatusBanner - Ranked matchmaking feedback states (story 4.1)
 * OWNER: Dev Team
 *
 * Toast-style banners fixed at the top — deliberately non-blocking: a
 * queued user can keep browsing the workspace while the server searches
 * for an opponent (unlike the blocking practice "Simulating..." overlay).
 *
 * - Waiting: "Searching for opponent..." with the AC #4 Cancel affordance.
 * - Matched: "Match found!" (no replay/score — simulation is story 4.2).
 * - Timeout: the AC #3 message.
 * - Error: the store's error message.
 *
 * Dismiss (matched/timeout/error) returns to idle; the underlying queue
 * row is never deleted by a dismiss (cancel is the only explicit exit).
 */

import type { MatchmakingPhase } from '@/stores/matchmakingStore';

interface QueueStatusBannerProps {
  status: MatchmakingPhase;
  /** Error message for the error state (ignored otherwise) */
  error: string | null;
  /** Leave the queue (waiting state only) */
  onCancel: () => void;
  /** Clear a terminal banner (matched/timeout/error) */
  onDismiss: () => void;
}

export const QueueStatusBanner: React.FC<QueueStatusBannerProps> = ({
  status,
  error,
  onCancel,
  onDismiss,
}) => {
  if (status === 'waiting' || status === 'joining') {
    return (
      <div style={styles.toast} data-testid="queue-searching-banner" role="status">
        <span style={styles.text}>Searching for opponent...</span>
        <button type="button" style={styles.button} data-testid="queue-cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  if (status === 'matched') {
    return (
      <div style={styles.toast} data-testid="queue-matched-banner" role="status">
        <span style={styles.text}>Match found!</span>
        <button type="button" style={styles.button} data-testid="queue-dismiss-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div style={styles.toast} data-testid="queue-timeout-banner" role="status">
        <span style={styles.text}>No opponent found, try again later</span>
        <button type="button" style={styles.button} data-testid="queue-dismiss-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={styles.toast} data-testid="queue-error-banner" role="status">
        <span style={styles.errorText} data-testid="queue-error-message">
          {error ?? 'Something went wrong. Please try again.'}
        </span>
        <button type="button" style={styles.button} data-testid="queue-dismiss-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }

  return null;
};

const styles: Record<string, React.CSSProperties> = {
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
  text: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#ffffff',
    whiteSpace: 'nowrap',
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
