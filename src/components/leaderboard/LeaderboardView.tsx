/**
 * LeaderboardView - Full-screen public leaderboard overlay (Epic 4 v2, story 4.5)
 * OWNER: Dev Team
 *
 * Rendered as an opaque layer ABOVE the workspace (the PixiJS engine stays
 * mounted underneath, same decision as RankedView): every non-system tactic
 * ranked by elo — ready or not, played or never played. Read-only: rows
 * expose owner + tactic name so players can find each other; the challenge
 * action lives in the ranked view's opponents pool.
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useRankedStore } from '@/stores/rankedStore';

interface LeaderboardViewProps {
  /** Whether the overlay is currently shown */
  open: boolean;
  /** Back to the workspace */
  onClose: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ open, onClose }) => {
  const {
    leaderboardEntries,
    isLoadingLeaderboard,
    leaderboardError,
    fetchLeaderboard,
  } = useRankedStore();

  // Usernames are DB-unique: owner === my username ⇔ my tactic (the
  // matchPerspective precedent)
  const myUsername = useAuthStore((state) => state.user?.username ?? null);

  // Refetch every open: elo moved since last time (no caching)
  useEffect(() => {
    if (open) {
      void fetchLeaderboard();
    }
  }, [open, fetchLeaderboard]);

  if (!open) return null;

  return (
    <div data-testid="leaderboard-view" style={styles.overlay}>
      <div style={styles.inner}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <button
            type="button"
            data-testid="leaderboard-back-button"
            style={styles.backButton}
            onClick={onClose}
          >
            ← Back to workspace
          </button>
          <h1 style={styles.title}>🏆 Leaderboard</h1>
          <div style={styles.topBarSpacer} />
        </div>

        <section data-testid="leaderboard-panel" style={styles.panel}>
          {leaderboardError && (
            <div data-testid="leaderboard-error" style={styles.emptyText}>
              {leaderboardError}
              <button
                type="button"
                data-testid="leaderboard-retry"
                style={styles.retryButton}
                onClick={() => void fetchLeaderboard()}
              >
                Retry
              </button>
            </div>
          )}
          {isLoadingLeaderboard && (
            <p data-testid="leaderboard-loading" style={styles.emptyText}>
              Loading leaderboard...
            </p>
          )}
          {!isLoadingLeaderboard && !leaderboardError && leaderboardEntries.length === 0 && (
            <p data-testid="leaderboard-empty" style={styles.emptyText}>
              No tactics on the board yet.
            </p>
          )}
          {!isLoadingLeaderboard &&
            leaderboardEntries.map((entry) => {
              const isMine = entry.owner === myUsername;

              return (
                <div
                  key={entry.id}
                  data-testid="leaderboard-row"
                  data-tactic-id={entry.id}
                  style={{ ...styles.row, ...(isMine ? styles.rowMine : {}) }}
                >
                  <div style={styles.rowMain}>
                    <span data-testid="leaderboard-rank" style={styles.rank}>
                      #{entry.rank}
                    </span>
                    <span data-testid="leaderboard-owner" style={styles.owner}>
                      {entry.owner ?? 'Unknown'}
                    </span>
                    <span data-testid="leaderboard-name" style={styles.rowName}>
                      {entry.name}
                    </span>
                    {isMine && (
                      <span data-testid="leaderboard-you" style={styles.youBadge}>
                        You
                      </span>
                    )}
                  </div>
                  <span data-testid="leaderboard-record" style={styles.record}>
                    {entry.elo} · {entry.wins}-{entry.losses}
                  </span>
                </div>
              );
            })}
        </section>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#1e1e1e',
    zIndex: 500,
    overflowY: 'auto',
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    padding: '16px 24px',
    maxWidth: '1100px',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  backButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
    margin: 0,
  },
  topBarSpacer: {
    flex: 1,
  },
  panel: {
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '8px',
    padding: '16px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 12px',
    borderBottom: '1px solid #3c3c3c',
  },
  rowMine: {
    borderLeft: '3px solid #0e639c',
  },
  rowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
    flex: 1,
  },
  rank: {
    color: '#9d9d9d',
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
    minWidth: '32px',
  },
  owner: {
    color: '#4ec9b0',
    fontSize: '13px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  rowName: {
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  youBadge: {
    padding: '1px 8px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    flexShrink: 0,
  },
  record: {
    color: '#9d9d9d',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  emptyText: {
    color: '#9d9d9d',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  retryButton: {
    padding: '4px 12px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
};
