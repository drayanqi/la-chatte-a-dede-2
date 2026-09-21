/**
 * HistoryList - My ranked match history (story 7.6)
 * OWNER: Dev Team
 *
 * Rows from MY side of each match (matchPerspective): V/D/N badge, opponent,
 * signed elo delta pill (mint win / corail loss) and the mono score. Each
 * row offers "Revoir" → the /match/:id viewer (AC #3).
 */

import { matchPerspective } from '@/lib/matchPerspective';
import type { MatchResult } from '@/types';

interface HistoryListProps {
  matches: MatchResult[];
  isLoading: boolean;
  error: string | null;
  myUsername: string | null;
  /** Open the /match/:id viewer for a settled match */
  onWatchReplay: (matchId: string) => void;
  onRetry: () => void;
}

/** Row badge letter + palette from MY outcome */
const OUTCOME_BADGE: Record<'win' | 'loss' | 'draw', { letter: string; background: string }> = {
  win: { letter: 'V', background: 'var(--mint)' },
  loss: { letter: 'D', background: 'var(--corail)' },
  draw: { letter: 'N', background: 'var(--muted)' },
};

export const HistoryList: React.FC<HistoryListProps> = ({
  matches,
  isLoading,
  error,
  myUsername,
  onWatchReplay,
  onRetry,
}) => {
  // Only completed matches render: failed rows moved nothing and are
  // unwatchable (story 4.4 scope boundary)
  const completed = matches.filter((match) => match.status === 'completed');

  if (isLoading) {
    return (
      <p data-testid="history-loading" style={styles.emptyText}>
        Chargement de l'historique...
      </p>
    );
  }

  if (error) {
    return (
      <div data-testid="history-error" style={styles.emptyText}>
        {error}
        <button
          type="button"
          data-testid="history-retry"
          style={styles.retryButton}
          onClick={onRetry}
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (completed.length === 0) {
    return (
      <p data-testid="history-empty" style={styles.emptyText}>
        Aucun match classé pour l'instant — lance-toi depuis « Match classé ».
      </p>
    );
  }

  return (
    <div data-testid="history-list">
      {completed.map((match) => {
        const perspective = matchPerspective(match, myUsername);
        const badge = OUTCOME_BADGE[perspective.outcome];

        return (
          <div
            key={match.id}
            data-testid="history-row"
            data-match-id={match.id}
            style={styles.row}
          >
            <span
              data-testid="history-outcome"
              style={{ ...styles.badge, background: badge.background }}
            >
              {badge.letter}
            </span>
            <span data-testid="history-opponent" style={styles.opponent}>
              vs {perspective.opponentLabel ?? 'adversaire inconnu'}
            </span>
            {typeof perspective.myPoints === 'number' && perspective.myPoints !== 0 && (
              <span
                data-testid="history-points"
                style={{
                  ...styles.pointsPill,
                  ...(perspective.myPoints > 0 ? styles.pointsWin : styles.pointsLoss),
                }}
              >
                {perspective.myPoints > 0 ? `+${perspective.myPoints}` : perspective.myPoints}
              </span>
            )}
            <span data-testid="history-score" style={styles.score}>
              {perspective.myScore} – {perspective.theirScore}
            </span>
            <button
              type="button"
              data-testid="history-watch-button"
              style={styles.watchButton}
              onClick={() => onWatchReplay(match.id)}
            >
              Revoir
            </button>
          </div>
        );
      })}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    padding: '9px 4px',
    borderBottom: '1px solid var(--line)',
    fontSize: '12.5px',
  },
  badge: {
    width: '26px',
    height: '26px',
    borderRadius: '10px',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    fontSize: '11px',
    color: '#fff',
    flexShrink: 0,
  },
  opponent: {
    color: 'var(--ink)',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pointsPill: {
    padding: '2px 9px',
    borderRadius: 99,
    fontSize: '11px',
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },
  pointsWin: {
    background: 'var(--mint)',
  },
  pointsLoss: {
    background: 'var(--corail)',
  },
  score: {
    marginLeft: 'auto',
    fontFamily: 'var(--mono)',
    fontWeight: 700,
    color: 'var(--ink)',
    whiteSpace: 'nowrap',
  },
  watchButton: {
    padding: '6px 11px',
    borderRadius: '11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    color: 'var(--ink)',
    flexShrink: 0,
  },
  emptyText: {
    color: 'var(--muted)',
    fontSize: '12.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  retryButton: {
    padding: '6px 11px',
    borderRadius: '11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    color: 'var(--ink)',
  },
};
