/**
 * ResultCard - The V/D card shown after a settled match (story 7.6)
 * OWNER: Dev Team
 *
 * Challenger-perspective outcome (mockup s-result): outcome disc (mint V /
 * corail D / muted N), score in mono, signed elo delta pill, "Revoir le
 * match" → /match/:id and "Retour au stade". Shared component: the teams
 * page reuses it for practice results (story 7.7).
 */

import type { MatchResult } from '@/types';

interface ResultCardProps {
  match: MatchResult;
  /** Watch the finished match in the /match/:id viewer */
  onWatchReplay: () => void;
  /** Back to where the match was started from */
  onClose: () => void;
}

/** Challenger-perspective presentation of the API outcome */
const OUTCOME_PRESENTATION: Record<
  'challenger_win' | 'opponent_win' | 'draw',
  { letter: string; label: string; color: string; shadow: string }
> = {
  challenger_win: {
    letter: 'V',
    label: 'Victoire',
    color: 'var(--mint)',
    shadow: '0 8px 22px rgba(49, 196, 141, 0.4)',
  },
  opponent_win: {
    letter: 'D',
    label: 'Défaite',
    color: 'var(--corail)',
    shadow: '0 8px 22px rgba(255, 107, 87, 0.4)',
  },
  draw: {
    letter: 'N',
    label: 'Match nul',
    color: 'var(--muted)',
    shadow: '0 8px 22px rgba(0, 0, 0, 0.2)',
  },
};

/** The signed elo delta I pocketed ('' while the elo did not move) */
const resultPointsLabel = (points: number | null | undefined): string => {
  if (typeof points !== 'number' || points === 0) return '';
  return points > 0 ? `+${points} elo` : `${points} elo`;
};

export const ResultCard: React.FC<ResultCardProps> = ({ match, onWatchReplay, onClose }) => {
  if (!match.result) return null;

  const presentation = OUTCOME_PRESENTATION[match.result];
  const pointsPill = resultPointsLabel(match.pointsChallenger);

  return (
    <div data-testid="result-card" style={styles.card}>
      <div
        data-testid="result-disc"
        style={{ ...styles.disc, background: presentation.color, boxShadow: presentation.shadow }}
      >
        {presentation.letter}
      </div>
      <h1 data-testid="result-outcome" style={{ ...styles.title, color: presentation.color }}>
        {presentation.label}
      </h1>
      <div style={styles.scoreLine}>
        <span data-testid="result-my-team" style={styles.teamName}>
          {match.challengerTacticName ?? 'Mon équipe'}
        </span>
        <span data-testid="result-score" style={styles.score}>
          {match.scoreChallenger} – {match.scoreOpponent}
        </span>
        <span data-testid="result-opponent" style={styles.opponentName}>
          {match.opponentName ?? 'FC Bot'}
        </span>
      </div>
      {pointsPill && (
        <span
          data-testid="result-points"
          style={{
            ...styles.pointsPill,
            ...(match.pointsChallenger && match.pointsChallenger > 0
              ? styles.pointsWin
              : styles.pointsLoss),
          }}
        >
          {pointsPill}
        </span>
      )}
      <div style={styles.actions}>
        <button
          type="button"
          data-testid="result-watch-replay-button"
          style={styles.ghostButton}
          onClick={onWatchReplay}
        >
          Revoir le match
        </button>
        <button
          type="button"
          data-testid="result-close-button"
          style={styles.primaryButton}
          onClick={onClose}
        >
          Retour au stade
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '9px',
    textAlign: 'center',
  },
  disc: {
    width: '66px',
    height: '66px',
    borderRadius: '50%',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontSize: '30px',
    fontWeight: 800,
  },
  title: {
    fontSize: '26px',
    fontWeight: 800,
    margin: 0,
  },
  scoreLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    margin: '4px 0',
  },
  teamName: {
    fontWeight: 800,
    color: 'var(--ink)',
  },
  score: {
    fontSize: '30px',
    fontWeight: 800,
    fontFamily: 'var(--mono)',
  },
  opponentName: {
    fontWeight: 800,
    color: 'var(--muted)',
  },
  pointsPill: {
    padding: '6px 16px',
    borderRadius: 99,
    fontSize: '13px',
    fontWeight: 700,
    alignSelf: 'center',
  },
  pointsWin: {
    background: 'var(--mint)',
    color: '#fff',
  },
  pointsLoss: {
    background: 'var(--corail)',
    color: '#fff',
  },
  actions: {
    display: 'flex',
    gap: '9px',
    justifyContent: 'center',
    marginTop: '8px',
  },
  ghostButton: {
    padding: '9px 16px',
    borderRadius: 'var(--r-btn)',
    fontWeight: 700,
    fontSize: '13px',
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    color: 'var(--ink)',
  },
  primaryButton: {
    padding: '9px 16px',
    borderRadius: 'var(--r-btn)',
    fontWeight: 700,
    fontSize: '13px',
    background: 'var(--corail)',
    color: '#fff',
    boxShadow: '0 4px 14px rgba(255, 107, 87, 0.35)',
  },
};
