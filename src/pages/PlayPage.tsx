/**
 * PlayPage - The lobby (story 7.6)
 * OWNER: Dev Team
 *
 * The app opens here (mockup s-jouer): hero card (greeting, elo + rank,
 * Match classé / Test vs Bot / Revoir le dernier match), the opponents of
 * the moment, my ranked history and the leaderboard rail. Without a ready
 * tactic an explanatory card takes the hero's place (AC #2). "Match classé"
 * opens the ranked chooser; a settled challenge lands in the history and
 * its result card offers the /match/:id viewer (AC #3).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appbar } from '@/components/layout/Appbar';
import { HistoryList } from '@/components/play/HistoryList';
import { LeaderboardRail } from '@/components/play/LeaderboardRail';
import { RankedChooser } from '@/components/play/RankedChooser';
import { useAuthStore } from '@/stores/authStore';
import { useMatchStore } from '@/stores/matchStore';
import { useRankedStore } from '@/stores/rankedStore';
import { useTacticsStore } from '@/stores/tacticsStore';

/** Engine match length (3 min at 60 fps) — the frames-estimate chip */
const ESTIMATED_FRAMES = 10800;

export const PlayPage: React.FC = () => {
  const navigate = useNavigate();
  const [chooserOpen, setChooserOpen] = useState(false);

  const myUsername = useAuthStore((state) => state.user?.username ?? null);

  const tactics = useTacticsStore((state) => state.tactics);
  const fetchTactics = useTacticsStore((state) => state.fetchTactics);

  const {
    opponents,
    isLoadingOpponents,
    opponentsError,
    match,
    isPlaying,
    fetchOpponents,
    clearResult,
    historyMatches,
    isLoadingHistory,
    historyError,
    fetchHistory,
    leaderboardEntries,
    isLoadingLeaderboard,
    leaderboardError,
    fetchLeaderboard,
  } = useRankedStore();

  const {
    latestMatch,
    fetchLatestMatch,
    isSimulating,
    matchError: practiceError,
    startPracticeMatch,
  } = useMatchStore();

  // Fetch-on-mount, per-section loading/error states downstream
  useEffect(() => {
    void fetchTactics();
    void fetchOpponents();
    void fetchHistory();
    void fetchLeaderboard();
    void fetchLatestMatch();
  }, [fetchTactics, fetchOpponents, fetchHistory, fetchLeaderboard, fetchLatestMatch]);

  // A settled challenge lands in the history immediately (AC #3) — the
  // pool + tactics refresh already happens inside the store's play actions
  const settledMatchId = match && !isPlaying ? match.id : null;
  useEffect(() => {
    if (settledMatchId) {
      void fetchHistory();
    }
  }, [settledMatchId, fetchHistory]);

  // Leaving the page drops the settled result: reopening the chooser must
  // not resurrect a stale result card
  useEffect(() => {
    return () => {
      clearResult();
    };
  }, [clearResult]);

  // "Mon équipe" = my best ready tactic (highest elo); its leaderboard row
  // carries the rank. System tactics are not mine.
  const bestTactic = useMemo(
    () =>
      tactics
        .filter((tactic) => tactic.isReady && !tactic.isSystem)
        .sort((a, b) => b.elo - a.elo)[0] ?? null,
    [tactics]
  );

  // Rail highlight: the fielded tactic when ranked, else my best-ranked row
  const myTacticId = bestTactic?.id ?? null;

  // Opponents cards + rail live for everyone; "Affronter" needs a fighter
  const hasReadyTactic = bestTactic !== null;

  const handlePractice = useCallback(() => {
    if (!bestTactic || isSimulating) return;

    void (async () => {
      await startPracticeMatch(bestTactic.id);
      const { lastMatch, matchError } = useMatchStore.getState();
      if (lastMatch && lastMatch.status === 'completed' && !matchError) {
        // ?fresh=1 (story 7.10): the pre-match ceremony plays — the match
        // was just generated, the teams walk onto the pitch
        navigate(`/match/${lastMatch.id}?fresh=1`);
      }
    })();
  }, [bestTactic, isSimulating, startPracticeMatch, navigate]);

  const handleWatchLastMatch = useCallback(() => {
    if (!latestMatch) return;
    navigate(`/match/${latestMatch.id}`);
  }, [latestMatch, navigate]);

  const handleWatchHistory = useCallback(
    (matchId: string) => {
      navigate(`/match/${matchId}`);
    },
    [navigate]
  );

  // Result card only (story 4.3): the match was just settled — the watch
  // hand-off carries ?fresh=1 so the ceremony plays (story 7.10)
  const handleWatchRankedResult = useCallback(
    (matchId: string) => {
      navigate(`/match/${matchId}?fresh=1`);
    },
    [navigate]
  );

  return (
    <div style={styles.page}>
      <Appbar />

      {chooserOpen ? (
        <RankedChooser
          onBack={() => setChooserOpen(false)}
          onWatchReplay={handleWatchRankedResult}
        />
      ) : (
        <div style={styles.moments}>
          <div style={styles.flow}>
            {/* Hero / no-ready card */}
            <div data-testid="play-hero" style={styles.card}>
              {hasReadyTactic && bestTactic ? (
                <div style={styles.heroInner}>
                  <div style={styles.heroText}>
                    <h1 data-testid="play-greeting" style={styles.h1}>
                      Salut {myUsername ?? 'joueur'}
                    </h1>
                    <p data-testid="play-hero-sub" style={styles.sub}>
                      « {bestTactic.name} » est prête. Elo{' '}
                      <b data-testid="play-hero-elo">{bestTactic.elo}</b>
                      <HeroRank tacticId={bestTactic.id} entries={leaderboardEntries} />
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="ranked-open-button"
                    style={styles.primaryButton}
                    onClick={() => setChooserOpen(true)}
                  >
                    Match classé
                  </button>
                  <button
                    type="button"
                    data-testid="practice-start-button"
                    style={styles.sunButton}
                    onClick={handlePractice}
                    disabled={isSimulating}
                  >
                    Test vs Bot
                  </button>
                  {latestMatch && (
                    <button
                      type="button"
                      data-testid="watch-last-match-button"
                      style={styles.ghostButton}
                      onClick={handleWatchLastMatch}
                    >
                      Revoir le dernier match
                    </button>
                  )}
                </div>
              ) : (
                <div data-testid="no-ready-state" style={styles.heroInner}>
                  <div style={styles.heroText}>
                    <h1 data-testid="play-greeting" style={styles.h1}>
                      Salut {myUsername ?? 'joueur'}
                    </h1>
                    <p data-testid="no-ready-text" style={styles.sub}>
                      Aucune équipe prête. Dans LACHATADEDE, une équipe c'est cinq scripts
                      alignés sur le terrain : prépare-la dans Équipes, marque-la « Prête »,
                      puis reviens défier le classement.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="go-to-teams-button"
                    style={styles.primaryButton}
                    onClick={() => navigate('/teams')}
                  >
                    Préparer une équipe
                  </button>
                  {latestMatch && (
                    <button
                      type="button"
                      data-testid="watch-last-match-button"
                      style={styles.ghostButton}
                      onClick={handleWatchLastMatch}
                    >
                      Revoir le dernier match
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Opponents of the moment */}
            <div data-testid="opponents-panel" style={styles.card}>
              <h2 style={styles.h2}>Adversaires du moment</h2>
              {isLoadingOpponents && (
                <p data-testid="opponents-loading" style={styles.emptyText}>
                  Chargement des adversaires...
                </p>
              )}
              {opponentsError && (
                <div data-testid="opponents-error" style={styles.emptyText}>
                  {opponentsError}
                  <button
                    type="button"
                    data-testid="opponents-retry"
                    style={styles.smallGhost}
                    onClick={() => void fetchOpponents()}
                  >
                    Réessayer
                  </button>
                </div>
              )}
              {!isLoadingOpponents && !opponentsError && opponents.length === 0 && (
                <p data-testid="opponents-empty" style={styles.emptyText}>
                  Aucun adversaire prêt pour l'instant.
                </p>
              )}
              {!isLoadingOpponents && !opponentsError && opponents.length > 0 && (
                <div data-testid="opponents-grid" style={styles.oppGrid}>
                  {opponents.slice(0, 6).map((opponent) => (
                    <div
                      key={opponent.id}
                      data-testid="opponent-card"
                      data-opponent-id={opponent.id}
                      style={styles.opp}
                    >
                      <span style={styles.oppCrest}>{opponent.crest ?? '⚽'}</span>
                      <div style={styles.oppMain}>
                        <b style={styles.oppName}>{opponent.name}</b>
                        <div style={styles.oppSub}>
                          {opponent.owner ?? 'Inconnu'} · {opponent.ownerTacticsCount} tactiques
                        </div>
                      </div>
                      <span style={styles.oppElo}>{opponent.elo}</span>
                      {hasReadyTactic && (
                        <button
                          type="button"
                          data-testid="opponent-challenge-button"
                          style={styles.smallPrimary}
                          onClick={() => setChooserOpen(true)}
                        >
                          Affronter
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ranked history */}
            <div data-testid="history-panel" style={styles.card}>
              <h2 style={styles.h2}>Historique</h2>
              <HistoryList
                matches={historyMatches}
                isLoading={isLoadingHistory}
                error={historyError}
                myUsername={myUsername}
                onWatchReplay={handleWatchHistory}
                onRetry={() => void fetchHistory()}
              />
            </div>
          </div>

          {/* Leaderboard rail */}
          <LeaderboardRail
            entries={leaderboardEntries}
            isLoading={isLoadingLeaderboard}
            error={leaderboardError}
            myUsername={myUsername}
            myTacticId={myTacticId}
            onSeeAll={() => navigate('/classement')}
            onRetry={() => void fetchLeaderboard()}
          />
        </div>
      )}

      {/* Practice simulating veil (the POST runs synchronously) */}
      {isSimulating && (
        <div data-testid="practice-simulating-overlay" role="status" style={styles.veil}>
          <span style={styles.spinner} aria-hidden="true" />
          <span style={styles.veilTitle}>Simulation en cours…</span>
          <span style={styles.veilChip}>
            ≈ {ESTIMATED_FRAMES.toLocaleString('fr-FR')} frames · environ quelques secondes
          </span>
        </div>
      )}

      {/* Practice failure toast (MatchStatusOverlay parity: retry, no dismiss) */}
      {practiceError && !isSimulating && (
        <div data-testid="practice-error-banner" role="alert" style={styles.practiceError}>
          <span data-testid="practice-error-message" style={styles.errorText}>
            {practiceError}
          </span>
          <button
            type="button"
            data-testid="practice-retry-button"
            style={styles.smallPrimary}
            onClick={handlePractice}
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
};

/** The rank suffix of my tactic's leaderboard row ('' when unranked) */
const HeroRank: React.FC<{
  tacticId: string;
  entries: { id: string; rank: number }[];
}> = ({ tacticId, entries }) => {
  const entry = entries.find((row) => row.id === tacticId);
  if (!entry) return null;
  return (
    <>
      {' · '}
      <span data-testid="play-hero-rank">{entry.rank}e du classement</span>
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  moments: {
    flex: 1,
    overflow: 'auto',
    padding: '12px 8px 8px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    minHeight: 0,
  },
  flow: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: 0,
  },
  card: {
    background: 'var(--panel)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    padding: '20px',
  },
  heroInner: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  heroText: {
    flex: 1,
    minWidth: '220px',
  },
  h1: {
    fontSize: '22px',
    fontWeight: 800,
    color: 'var(--ink)',
    margin: 0,
  },
  h2: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--ink)',
    margin: '0 0 11px',
  },
  sub: {
    color: 'var(--muted)',
    fontSize: '12.5px',
    marginTop: '3px',
    lineHeight: 1.5,
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
  sunButton: {
    padding: '9px 16px',
    borderRadius: 'var(--r-btn)',
    fontWeight: 700,
    fontSize: '13px',
    background: 'var(--sun)',
    color: '#12241b',
    boxShadow: '0 4px 14px rgba(255, 194, 68, 0.3)',
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
  smallPrimary: {
    padding: '6px 11px',
    borderRadius: '11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--corail)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(255, 107, 87, 0.35)',
    flexShrink: 0,
  },
  smallGhost: {
    padding: '6px 11px',
    borderRadius: '11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    color: 'var(--ink)',
  },
  oppGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  opp: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'var(--panel2)',
    borderRadius: '16px',
    padding: '13px',
  },
  oppCrest: {
    fontSize: '22px',
    flexShrink: 0,
  },
  oppMain: {
    minWidth: 0,
    flex: 1,
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
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    color: 'var(--muted)',
    flexShrink: 0,
  },
  emptyText: {
    color: 'var(--muted)',
    fontSize: '12.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  veil: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    background: 'rgba(10, 20, 14, 0.55)',
    backdropFilter: 'blur(3px)',
    cursor: 'wait',
  },
  spinner: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    border: '4px solid rgba(255, 255, 255, 0.25)',
    borderTopColor: 'var(--sun)',
    animation: 'lachatadede-spin 1s linear infinite',
  },
  veilTitle: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '0.04em',
  },
  veilChip: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#fff',
    background: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 99,
    padding: '5px 14px',
  },
  practiceError: {
    position: 'fixed',
    top: '72px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '10px 20px',
    background: 'var(--panel)',
    border: '1px solid var(--corail)',
    borderRadius: 'var(--r-btn)',
    boxShadow: 'var(--shadow-lg)',
  },
  errorText: {
    fontSize: '12.5px',
    fontWeight: 600,
    color: 'var(--corail)',
  },
};
