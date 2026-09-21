/**
 * RankedChooser - The "Match classé" flow (story 7.6)
 * OWNER: Dev Team
 *
 * La Ronde restyle of the ranked matchmaking flow (mockup s-ranked): my
 * ready tactics in a select, the challengeable opponents pool with
 * "Affronter", the simulating banner and the result card. Challenge only —
 * quick match is not in the lobby design (scope boundary).
 */

import { useEffect, useMemo, useState } from 'react';
import { useRankedStore } from '@/stores/rankedStore';
import { useTacticsStore } from '@/stores/tacticsStore';
import { ResultCard } from './ResultCard';

interface RankedChooserProps {
  /** Back to the lobby (Retour) */
  onBack: () => void;
  /** Watch the settled match in the /match/:id viewer */
  onWatchReplay: (matchId: string) => void;
}

export const RankedChooser: React.FC<RankedChooserProps> = ({ onBack, onWatchReplay }) => {
  const {
    opponents,
    isLoadingOpponents,
    opponentsError,
    match,
    isPlaying,
    matchError,
    fetchOpponents,
    challenge,
    clearResult,
  } = useRankedStore();

  const tactics = useTacticsStore((state) => state.tactics);

  // My ranked fighters: ready tactics, readying is what puts a tactic in
  // the pool. Best (highest elo) first — it is the default selection.
  const myFighters = useMemo(
    () =>
      tactics
        .filter((tactic) => tactic.isReady && !tactic.isSystem)
        .sort((a, b) => b.elo - a.elo),
    [tactics]
  );

  // "Fighting as" selection: defaults to the best fighter, follows the list
  // if the selection disappears (deleted / un-ready)
  const [fightingAsId, setFightingAsId] = useState<string | null>(null);
  const fightingAs =
    myFighters.find((tactic) => tactic.id === fightingAsId) ?? myFighters[0] ?? null;

  // Fresh pool on every open (elo moved since the last visit)
  useEffect(() => {
    void fetchOpponents();
  }, [fetchOpponents]);

  const handleChallenge = (opponentId: string) => {
    if (fightingAs) {
      void challenge(fightingAs.id, opponentId);
    }
  };

  return (
    <div data-testid="ranked-view" style={styles.wrap}>
      <div style={styles.flow}>
        {/* Header card: what this flow is + my fighter select */}
        <div style={styles.headerCard}>
          <div style={styles.headerText}>
            <h1 style={styles.h1}>Match classé</h1>
            <p style={styles.sub}>
              Choisis ton équipe et ton adversaire. Ton elo est en jeu.
            </p>
          </div>
          <select
            data-testid="ranked-fighter-select"
            value={fightingAs?.id ?? ''}
            onChange={(event) => setFightingAsId(event.target.value)}
            style={styles.select}
            aria-label="Mon équipe"
          >
            {myFighters.length === 0 && <option value="">Aucune équipe prête</option>}
            {myFighters.map((tactic) => (
              <option key={tactic.id} value={tactic.id}>
                {tactic.name} · {tactic.elo} elo
              </option>
            ))}
          </select>
        </div>

        {/* Simulating banner */}
        {isPlaying && (
          <div data-testid="ranked-simulating-banner" role="status" style={styles.banner}>
            <span style={styles.spinner} aria-hidden="true" />
            <span style={styles.bannerText}>Simulation en cours…</span>
          </div>
        )}

        {/* Error banner */}
        {matchError && (
          <div data-testid="ranked-error-banner" role="alert" style={styles.errorBanner}>
            <span data-testid="ranked-error-message" style={styles.errorText}>
              {matchError}
            </span>
            <button
              type="button"
              data-testid="ranked-error-dismiss"
              style={styles.smallButton}
              onClick={clearResult}
            >
              Fermer
            </button>
          </div>
        )}

        {/* Result card after a settled challenge */}
        {match && !isPlaying && (
          <div style={styles.resultCard}>
            <ResultCard
              match={match}
              onWatchReplay={() => onWatchReplay(match.id)}
              onClose={clearResult}
            />
          </div>
        )}

        {/* Opponents pool (hidden while a result is shown) */}
        {!match && !isPlaying && (
          <div style={styles.listCard}>
            {opponentsError && (
              <div data-testid="ranked-opponents-error" style={styles.emptyText}>
                {opponentsError}
                <button
                  type="button"
                  data-testid="ranked-opponents-retry"
                  style={styles.smallButton}
                  onClick={() => void fetchOpponents()}
                >
                  Réessayer
                </button>
              </div>
            )}
            {isLoadingOpponents && (
              <p data-testid="ranked-opponents-loading" style={styles.emptyText}>
                Chargement des adversaires...
              </p>
            )}
            {!isLoadingOpponents && !opponentsError && opponents.length === 0 && (
              <p data-testid="ranked-empty-opponents" style={styles.emptyText}>
                Aucun adversaire prêt pour l'instant — reviens plus tard, ou laisse tes
                équipes prêtes pour être défié pendant ton absence.
              </p>
            )}
            {!isLoadingOpponents &&
              opponents.map((opponent) => (
                <div
                  key={opponent.id}
                  data-testid="ranked-opponent-row"
                  data-opponent-id={opponent.id}
                  style={styles.oppRow}
                >
                  <span style={styles.crest}>{opponent.crest ?? '⚽'}</span>
                  <div style={styles.oppMain}>
                    <b style={styles.oppName}>{opponent.name}</b>
                    <div style={styles.oppSub}>
                      {opponent.owner ?? 'Inconnu'} · {opponent.ownerTacticsCount} tactiques
                    </div>
                  </div>
                  <span style={styles.oppElo}>{opponent.elo}</span>
                  <button
                    type="button"
                    data-testid="ranked-challenge-button"
                    data-opponent-id={opponent.id}
                    style={styles.challengeButton}
                    disabled={isPlaying || !fightingAs}
                    onClick={() => handleChallenge(opponent.id)}
                  >
                    Affronter
                  </button>
                </div>
              ))}
          </div>
        )}

        <button type="button" data-testid="ranked-back-button" style={styles.backButton} onClick={onBack}>
          Retour
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    padding: '12px 8px 8px',
    overflow: 'auto',
    minHeight: 0,
  },
  flow: {
    width: '100%',
    maxWidth: '640px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  headerCard: {
    background: 'var(--panel)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerText: {
    flex: 1,
  },
  h1: {
    fontSize: '22px',
    fontWeight: 800,
    color: 'var(--ink)',
    margin: 0,
  },
  sub: {
    color: 'var(--muted)',
    fontSize: '12.5px',
    marginTop: '3px',
    lineHeight: 1.5,
  },
  select: {
    border: '1.5px solid var(--line)',
    background: 'var(--panel2)',
    color: 'var(--ink)',
    borderRadius: '12px',
    padding: '10px 13px',
    fontSize: '13px',
    outline: 'none',
  },
  banner: {
    background: 'var(--panel)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    justifyContent: 'center',
  },
  spinner: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: '3px solid var(--panel2)',
    borderTopColor: 'var(--mint)',
    animation: 'lachatadede-spin 0.9s linear infinite',
  },
  bannerText: {
    fontWeight: 700,
    fontSize: '13px',
    color: 'var(--ink)',
  },
  errorBanner: {
    background: 'var(--panel)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--corail)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  errorText: {
    flex: 1,
    color: 'var(--corail)',
    fontWeight: 600,
    fontSize: '12.5px',
  },
  resultCard: {
    background: 'var(--panel)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    padding: '28px 20px',
  },
  listCard: {
    background: 'var(--panel)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  oppRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'var(--panel2)',
    borderRadius: '16px',
    padding: '13px',
  },
  crest: {
    fontSize: '22px',
    flexShrink: 0,
  },
  oppMain: {
    minWidth: 0,
  },
  oppName: {
    fontSize: '12.5px',
    color: 'var(--ink)',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  oppSub: {
    color: 'var(--muted)',
    fontSize: '12px',
    marginTop: '2px',
  },
  oppElo: {
    marginLeft: 'auto',
    fontFamily: 'var(--mono)',
    fontSize: '13px',
    color: 'var(--muted)',
    flexShrink: 0,
  },
  challengeButton: {
    padding: '6px 11px',
    borderRadius: '11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--corail)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(255, 107, 87, 0.35)',
    flexShrink: 0,
  },
  backButton: {
    padding: '9px 16px',
    borderRadius: 'var(--r-btn)',
    fontWeight: 700,
    fontSize: '13px',
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    color: 'var(--ink)',
    alignSelf: 'center',
    minWidth: '160px',
  },
  smallButton: {
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
    padding: '10px 12px',
  },
};
