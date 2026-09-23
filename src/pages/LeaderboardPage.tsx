/**
 * LeaderboardPage - Classement route (story 7.2)
 *
 * Every non-system tactic ranked by elo — ready or not, played or never
 * played. Read-only: rows expose owner + tactic name; the challenge action
 * lives on the Play page. (Story 4.5 view, re-homed from the overlay
 * anatomy to a real page and dressed in La Ronde tokens.)
 */

import { useEffect } from 'react';
import { Appbar } from '@/components/layout/Appbar';
import { useAuthStore } from '@/stores/authStore';
import { useRankedStore } from '@/stores/rankedStore';

export const LeaderboardPage: React.FC = () => {
  const {
    leaderboardEntries,
    isLoadingLeaderboard,
    leaderboardError,
    fetchLeaderboard,
  } = useRankedStore();

  // Usernames are DB-unique: owner === my username ⇔ my tactic (the
  // matchPerspective precedent)
  const myUsername = useAuthStore((state) => state.user?.username ?? null);

  // Refetch every mount: elo moved since last time (no caching)
  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div style={styles.page}>
      <Appbar />
      <div style={styles.body}>
        <div style={styles.flow}>
          <div data-testid="leaderboard-view" style={styles.card}>
            <div style={styles.cardHeader}>
              <h1 style={styles.title}>Classement</h1>
              <p style={styles.sub}>Toutes les équipes, du plus fort au plus frais.</p>
            </div>

            <div data-testid="leaderboard-panel" style={styles.tableCard}>
              {leaderboardError && (
                <div data-testid="leaderboard-error" style={styles.emptyText}>
                  {leaderboardError}
                  <button
                    type="button"
                    data-testid="leaderboard-retry"
                    style={styles.retryButton}
                    onClick={() => void fetchLeaderboard()}
                  >
                    Réessayer
                  </button>
                </div>
              )}
              {isLoadingLeaderboard && (
                <p data-testid="leaderboard-loading" style={styles.emptyText}>
                  Chargement du classement...
                </p>
              )}
              {!isLoadingLeaderboard && !leaderboardError && leaderboardEntries.length === 0 && (
                <p data-testid="leaderboard-empty" style={styles.emptyText}>
                  Aucune équipe au classement pour l'instant.
                </p>
              )}
              {!isLoadingLeaderboard && leaderboardEntries.length > 0 && (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>Joueur</th>
                      <th style={styles.th}>Équipe</th>
                      <th style={styles.th}>Elo · V-D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardEntries.map((entry) => {
                      // A null owner (deleted user) is never me
                      const isMine = myUsername !== null && entry.owner === myUsername;

                      return (
                        <tr
                          key={entry.id}
                          data-testid="leaderboard-row"
                          data-tactic-id={entry.id}
                          style={{ ...styles.row, ...(isMine ? styles.rowMine : {}) }}
                        >
                          <td data-testid="leaderboard-rank" style={styles.td}>
                            #{entry.rank}
                          </td>
                          <td data-testid="leaderboard-owner" style={styles.td}>
                            {entry.owner ?? 'Unknown'}
                            {isMine && (
                              <span data-testid="leaderboard-you" style={styles.youBadge}>
                                You
                              </span>
                            )}
                          </td>
                          <td data-testid="leaderboard-name" style={styles.tdName}>
                            <span style={styles.nameCell}>
                              {entry.crest ? (
                                <span style={styles.crest}>{entry.crest}</span>
                              ) : (
                                <span
                                  style={{
                                    ...styles.crestDot,
                                    background: entry.colorPrimary,
                                  }}
                                />
                              )}
                              {entry.name}
                            </span>
                          </td>
                          <td data-testid="leaderboard-record" style={styles.tdRecord}>
                            {entry.elo} · {entry.wins}-{entry.losses}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
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
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '12px 8px 8px',
  },
  flow: {
    maxWidth: '680px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    background: 'var(--panel)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    padding: '20px',
  },
  cardHeader: {
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--ink)',
  },
  sub: {
    color: 'var(--muted)',
    fontSize: '12.5px',
    marginTop: 3,
    lineHeight: 1.5,
  },
  tableCard: {
    padding: 10,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12.5px',
  },
  th: {
    textAlign: 'left',
    fontSize: '10.5px',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--muted)',
    padding: '8px 12px',
    borderBottom: '1px solid var(--line)',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--line)',
    fontWeight: 600,
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
  },
  tdName: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--line)',
    fontWeight: 700,
    color: 'var(--ink)',
  },
  nameCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  crest: {
    fontSize: '15px',
  },
  crestDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  tdElo: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--line)',
    fontFamily: 'var(--mono)',
    fontWeight: 600,
  },
  tdRecord: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--line)',
    fontFamily: 'var(--mono)',
    color: 'var(--muted)',
  },
  row: {},
  rowMine: {
    background: 'rgba(255, 194, 68, 0.16)',
    fontWeight: 700,
  },
  youBadge: {
    marginLeft: 8,
    padding: '1px 8px',
    background: 'var(--sun)',
    color: '#12241b',
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 700,
  },
  emptyText: {
    color: 'var(--muted)',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  retryButton: {
    padding: '6px 14px',
    borderRadius: 'var(--r-btn)',
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    color: 'var(--ink)',
    fontWeight: 700,
    fontSize: 12,
  },
};
