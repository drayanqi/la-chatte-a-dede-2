/**
 * LeaderboardRail - The "Top classement" side rail (story 7.6)
 * OWNER: Dev Team
 *
 * Top 5 rows of the public leaderboard plus my own row appended (sun
 * highlight) when it sits below the fold. "Voir tout le classement" hands
 * over to /classement. Ranks come from the server payload — never re-sorted
 * client-side.
 */

import type { LeaderboardEntry } from '@/types';

interface LeaderboardRailProps {
  entries: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  myUsername: string | null;
  /** My fielded tactic — its row is the highlighted one */
  myTacticId: string | null;
  onSeeAll: () => void;
  onRetry: () => void;
}

export const LeaderboardRail: React.FC<LeaderboardRailProps> = ({
  entries,
  isLoading,
  error,
  myUsername,
  myTacticId,
  onSeeAll,
  onRetry,
}) => {
  const topRows = entries.slice(0, 5);

  // My highlighted row: the fielded tactic when ranked, else my best-ranked
  // tactic (usernames are DB-unique — matchPerspective precedent). A null
  // owner (deleted user) can never be mine.
  const myRow =
    (myTacticId ? entries.find((entry) => entry.id === myTacticId) : null) ??
    (myUsername !== null
      ? entries.find((entry) => entry.owner !== null && entry.owner === myUsername)
      : null) ??
    null;
  const showMyRow = myRow !== null && !topRows.some((entry) => entry.id === myRow.id);

  return (
    <aside data-testid="play-rail" style={styles.rail}>
      <h2 style={styles.title}>Top classement</h2>

      {isLoading && (
        <p data-testid="rail-loading" style={styles.emptyText}>
          Chargement...
        </p>
      )}
      {error && (
        <div data-testid="rail-error" style={styles.emptyText}>
          {error}
          <button type="button" data-testid="rail-retry" style={styles.retryButton} onClick={onRetry}>
            Réessayer
          </button>
        </div>
      )}
      {!isLoading && !error && entries.length === 0 && (
        <p data-testid="rail-empty" style={styles.emptyText}>
          Classement vide pour l'instant.
        </p>
      )}

      {!isLoading &&
        !error &&
        topRows.map((entry) => (
          <RailRow key={entry.id} entry={entry} isMine={entry.owner === myUsername} />
        ))}
      {!isLoading && !error && showMyRow && <RailRow entry={myRow} isMine />}

      <button
        type="button"
        data-testid="rail-see-all"
        style={styles.seeAll}
        onClick={onSeeAll}
      >
        Voir tout le classement
      </button>
    </aside>
  );
};

const RailRow: React.FC<{ entry: LeaderboardEntry; isMine: boolean }> = ({ entry, isMine }) => (
  <div
    data-testid={isMine ? 'rail-my-row' : 'rail-row'}
    data-tactic-id={entry.id}
    style={{ ...styles.row, ...(isMine ? styles.rowMine : {}) }}
  >
    <span style={{ ...styles.rank, ...(isMine ? styles.mineInk : {}) }}>{entry.rank}</span>
    <span style={styles.crest}>{entry.crest ?? '⚽'}</span>
    <span style={{ ...styles.name, ...(isMine ? styles.mineInk : {}) }}>{entry.name}</span>
    <span style={{ ...styles.elo, ...(isMine ? styles.mineInk : {}) }}>{entry.elo}</span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  rail: {
    width: '235px',
    flexShrink: 0,
    background: 'var(--panel)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    padding: '15px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--ink)',
    margin: '0 0 8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '8px 7px',
    borderRadius: '12px',
    fontSize: '12.5px',
    color: 'var(--ink)',
  },
  rowMine: {
    background: 'var(--sun)',
    color: '#12241b',
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(255, 194, 68, 0.4)',
  },
  mineInk: {
    color: '#12241b',
  },
  rank: {
    width: '22px',
    fontWeight: 800,
    color: 'var(--muted)',
    fontSize: '12px',
    flexShrink: 0,
  },
  crest: {
    fontSize: '15px',
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  elo: {
    marginLeft: 'auto',
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    color: 'var(--muted)',
  },
  seeAll: {
    width: '100%',
    marginTop: '9px',
    padding: '8px 11px',
    borderRadius: '11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    color: 'var(--ink)',
  },
  emptyText: {
    color: 'var(--muted)',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  retryButton: {
    padding: '5px 10px',
    borderRadius: '11px',
    fontSize: '11px',
    fontWeight: 700,
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    color: 'var(--ink)',
  },
};
