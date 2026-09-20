/**
 * RankedView - Full-screen ranked matchmaking overlay (Epic 4 v2, story 4.3)
 * OWNER: Dev Team
 *
 * Rendered as an opaque layer ABOVE the workspace (AppShell keeps the
 * PixiJS engine and panels mounted underneath): my ready fighters on the
 * left, the challengeable opponents pool on the right, one play flow at a
 * time. The opponent does not need to be online — the simulation runs in
 * the request and lands in their history.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRankedStore } from '@/stores/rankedStore';
import { useTacticsStore } from '@/stores/tacticsStore';
import type { MatchResult, MatchOutcome, TacticConfig } from '@/types';

interface RankedViewProps {
  /** Whether the overlay is currently shown */
  open: boolean;
  /** Back to the workspace */
  onClose: () => void;
  /** Watch the completed match's replay (the shell closes the overlay first) */
  onWatchReplay: (match: MatchResult) => void;
}

/** My perspective label for the outcome (I am always the challenger in ranked v1) */
const outcomeLabel = (result: MatchOutcome): string =>
  result === 'challenger_win' ? 'Victory' : result === 'opponent_win' ? 'Defeat' : 'Draw';

/** The elo delta I pocketed, signed */
const pointsLabel = (points: number | null | undefined): string => {
  if (typeof points !== 'number') return '';
  return points > 0 ? `+${points}` : `${points}`;
};

export const RankedView: React.FC<RankedViewProps> = ({ open, onClose, onWatchReplay }) => {
  const {
    opponents,
    isLoadingOpponents,
    opponentsError,
    match,
    isPlaying,
    matchError,
    activeTacticId,
    fetchOpponents,
    quickMatch,
    challenge,
    clearResult,
  } = useRankedStore();

  const tactics = useTacticsStore((state) => state.tactics);

  // My ranked fighters: ready tactics, readying is what puts a tactic in
  // the pool (the tab toggle is the entry point)
  const myFighters = useMemo(
    () => tactics.filter((tactic) => tactic.isReady && !tactic.isSystem),
    [tactics]
  );

  // "Fighting as" selection for challenges: defaults to the first fighter,
  // follows the list if the selection disappears
  const [fightingAsId, setFightingAsId] = useState<string | null>(null);
  const fightingAs =
    myFighters.find((tactic) => tactic.id === fightingAsId) ?? myFighters[0] ?? null;

  // Refresh the pool each time the view opens (elo moved since last time)
  useEffect(() => {
    if (open) {
      void fetchOpponents();
    }
  }, [open, fetchOpponents]);

  if (!open) return null;

  const handleQuickMatch = (tacticId: string) => {
    void quickMatch(tacticId);
  };

  const handleChallenge = (opponentId: string) => {
    if (fightingAs) {
      void challenge(fightingAs.id, opponentId);
    }
  };

  const playedTactic = myFighters.find((tactic) => tactic.id === activeTacticId) ?? null;

  return (
    <div data-testid="ranked-view" style={styles.overlay}>
      <div style={styles.inner}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <button
            type="button"
            data-testid="ranked-back-button"
            style={styles.backButton}
            onClick={onClose}
          >
            ← Back to workspace
          </button>
          <h1 style={styles.title}>⚔ Ranked</h1>
          <div style={styles.topBarSpacer} />
        </div>

        {/* Simulating / result / error banners */}
        {isPlaying && (
          <div data-testid="ranked-simulating-banner" role="status" style={styles.banner}>
            Simulating match
            {playedTactic ? ` — ${playedTactic.name} is fighting...` : '...'}
          </div>
        )}
        {matchError && (
          <div data-testid="ranked-error-banner" role="alert" style={styles.bannerError}>
            <span data-testid="ranked-error-message">{matchError}</span>
            <button
              type="button"
              data-testid="ranked-error-dismiss"
              style={styles.bannerButton}
              onClick={clearResult}
            >
              Dismiss
            </button>
          </div>
        )}
        {match && !isPlaying && (
          <div data-testid="ranked-result-banner" role="status" style={styles.bannerResult}>
            <span data-testid="ranked-result-outcome" style={styles.resultOutcome}>
              {outcomeLabel(match.result)}
            </span>
            <span data-testid="ranked-result-score" style={styles.resultScore}>
              {match.scoreChallenger} — {match.scoreOpponent}
            </span>
            <span style={styles.resultOpponent}>
              vs {match.opponentName ?? 'unknown'}
            </span>
            <span data-testid="ranked-result-points" style={styles.resultPoints}>
              {pointsLabel(match.pointsChallenger)} elo
            </span>
            <button
              type="button"
              data-testid="ranked-watch-replay-button"
              style={styles.bannerButton}
              onClick={() => onWatchReplay(match)}
            >
              ▶ Watch replay
            </button>
            <button
              type="button"
              data-testid="ranked-close-result-button"
              style={styles.bannerButtonSecondary}
              onClick={clearResult}
            >
              Close
            </button>
          </div>
        )}

        <div style={styles.columns}>
          {/* My fighters */}
          <section data-testid="ranked-my-fighters" style={styles.panel}>
            <h2 style={styles.panelTitle}>My fighters</h2>
            {myFighters.length === 0 ? (
              <p data-testid="ranked-empty-fighters" style={styles.emptyText}>
                No ready tactics. Mark one ready from its workspace tab, then come back.
              </p>
            ) : (
              myFighters.map((tactic) => (
                <div
                  key={tactic.id}
                  data-testid="ranked-my-fighter-row"
                  data-tactic-id={tactic.id}
                  style={styles.row}
                >
                  <div style={styles.rowMain}>
                    <span style={styles.rowName}>{tactic.name}</span>
                    <span data-testid="fighter-record" style={styles.record}>
                      {tactic.elo} · {tactic.wins}-{tactic.losses}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="ranked-quick-match-button"
                    data-tactic-id={tactic.id}
                    style={{
                      ...styles.rowButton,
                      ...(isPlaying ? styles.rowButtonDisabled : {}),
                    }}
                    disabled={isPlaying}
                    onClick={() => handleQuickMatch(tactic.id)}
                  >
                    ⚡ Quick Match
                  </button>
                </div>
              ))
            )}
          </section>

          {/* Opponents */}
          <section data-testid="ranked-opponents" style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Opponents</h2>
              {fightingAs && (
                <label style={styles.fighterSelectLabel}>
                  Fighting as
                  <select
                    data-testid="ranked-fighter-select"
                    value={fightingAs.id}
                    onChange={(event) => setFightingAsId(event.target.value)}
                    style={styles.fighterSelect}
                  >
                    {myFighters.map((tactic: TacticConfig) => (
                      <option key={tactic.id} value={tactic.id}>
                        {tactic.name} ({tactic.elo})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {opponentsError && (
              <div data-testid="ranked-opponents-error" style={styles.emptyText}>
                {opponentsError}
                <button
                  type="button"
                  data-testid="ranked-opponents-retry"
                  style={styles.bannerButton}
                  onClick={() => void fetchOpponents()}
                >
                  Retry
                </button>
              </div>
            )}
            {isLoadingOpponents && (
              <p data-testid="ranked-opponents-loading" style={styles.emptyText}>
                Loading opponents...
              </p>
            )}
            {!isLoadingOpponents && !opponentsError && opponents.length === 0 && (
              <p data-testid="ranked-empty-opponents" style={styles.emptyText}>
                No opponents ready yet. Come back later — or leave your tactics ready so
                others can challenge you while you are away.
              </p>
            )}
            {!isLoadingOpponents &&
              opponents.map((opponent) => (
                <div
                  key={opponent.id}
                  data-testid="ranked-opponent-row"
                  data-opponent-id={opponent.id}
                  style={styles.row}
                >
                  <div style={styles.rowMain}>
                    <span style={styles.rowName}>
                      {opponent.owner ?? 'Unknown'} — {opponent.name}
                    </span>
                    <span data-testid="opponent-record" style={styles.record}>
                      {opponent.elo} · {opponent.wins}-{opponent.losses}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="ranked-challenge-button"
                    data-opponent-id={opponent.id}
                    style={{
                      ...styles.rowButton,
                      ...(isPlaying || !fightingAs ? styles.rowButtonDisabled : {}),
                    }}
                    disabled={isPlaying || !fightingAs}
                    onClick={() => handleChallenge(opponent.id)}
                  >
                    ⚔ Challenge
                  </button>
                </div>
              ))}
          </section>
        </div>
      </div>
    </div>
  );
};

/** Shared banner chrome for the simulating / result / error states */
const bannerBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 16px',
  backgroundColor: '#252526',
  border: '1px solid #3c3c3c',
  borderRadius: '8px',
  color: '#cccccc',
  fontSize: '13px',
  marginBottom: '8px',
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
  banner: bannerBase,
  bannerError: {
    ...bannerBase,
    color: '#f48771',
  },
  bannerResult: {
    ...bannerBase,
    gap: '16px',
  },
  resultOutcome: {
    fontWeight: 700,
    fontSize: '14px',
    color: '#ffffff',
  },
  resultScore: {
    fontWeight: 600,
    fontSize: '15px',
    color: '#ffffff',
  },
  resultOpponent: {
    color: '#9d9d9d',
  },
  resultPoints: {
    fontWeight: 600,
    color: '#22c55e',
  },
  bannerButton: {
    padding: '4px 12px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  bannerButtonSecondary: {
    padding: '4px 12px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  columns: {
    display: 'flex',
    gap: '24px',
    flex: 1,
    alignItems: 'flex-start',
  },
  panel: {
    flex: 1,
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '8px',
    padding: '16px',
    minWidth: 0,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  panelTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    margin: '0 0 12px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  fighterSelectLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#9d9d9d',
    marginBottom: '8px',
  },
  fighterSelect: {
    backgroundColor: '#3c3c3c',
    color: '#ffffff',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 12px',
    borderBottom: '1px solid #3c3c3c',
  },
  rowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
    flex: 1,
  },
  rowName: {
    color: '#ffffff',
    fontSize: '13px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  record: {
    color: '#9d9d9d',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  rowButton: {
    padding: '6px 14px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    flexShrink: 0,
  },
  rowButtonDisabled: {
    backgroundColor: '#3c3c3c',
    color: '#808080',
    cursor: 'not-allowed',
  },
  emptyText: {
    color: '#9d9d9d',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
};
