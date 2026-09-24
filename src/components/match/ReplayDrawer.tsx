/**
 * ReplayDrawer - the right drawer of the broadcast replay (stories 7.7 + 7.9)
 *
 * Design source of truth: planning-artifacts/stadium-mockup-ronde-replay-stats-s1-tableau-de-bord.html
 * ("S1 · Tableau de bord", validated by Pelo).
 *
 * Two tabs:
 * - Stats: the S1 dashboard — VS header with the live score, the engine
 *   telemetry (possession bar + sparkline, tirs/récups/dribbles mirrored
 *   rows, distance ranking) when the replay carries a stats block, honest
 *   ghost states otherwise (story 7.9: no invented numbers), and the goals
 *   list linked to frames.
 * - Logs: the old debugger panel's data (story 3.10 pipeline reused
 *   as-is) — goal/shot rows linked to frames + windowed log rows with
 *   player filter chips.
 *
 * Presentational component: every datum arrives via props, the page owns
 * the stores and the canvas handle.
 */

import { useMemo, useState } from 'react';
import { formatTime } from '@/lib/timeFormat';
import { filterLogsByPlayer, logsAroundTick, type ReplayLogEntry } from '@/lib/replayLogs';
import { matchPlayerKey, matchPlayerFromKey } from '@/lib/teamMapping';
import { resolveMatchKits } from '@/lib/teamColors';
import { type MatchEventEntry } from '@/lib/matchEvents';
import type { GoalEventEntry, Score } from '@/lib/score';
import type { MatchResult, MatchShotEvent, MatchStats, MatchTeam } from '@/types';

export type ReplayDrawerTab = 'stats' | 'logs';

interface ReplayDrawerProps {
  match: MatchResult | null;
  score: Score;
  goalEvents: GoalEventEntry[];
  shotEvents: MatchEventEntry<MatchShotEvent>[];
  logs: ReplayLogEntry[];
  stats: MatchStats | null;
  currentFrame: number;
  totalFrames: number;
  /** Live log filter (canvas store): synced with pitch selection (story 3.11) */
  filterPlayerId: string | null;
  /** Chip/"Tous" filter changes: the page owns the store write + selection */
  onFilterPlayer: (playerId: string | null) => void;
  onSeekFrame: (frame: number) => void;
}

const MODE_LABELS: Record<string, string> = {
  ranked: 'Classé',
  practice: 'Entraînement',
};

/** Sparkline geometry: 276x34 viewBox, one x-step per possession bin */
const SPARK_WIDTH = 276;
const SPARK_HEIGHT = 34;
/** Possession bins are 300 ticks (5s) — must match the engine's Telemetry */
const POSSESSION_BIN_TICKS = 300;

export const ReplayDrawer: React.FC<ReplayDrawerProps> = ({
  match,
  score,
  goalEvents,
  shotEvents,
  logs,
  stats,
  currentFrame,
  totalFrames,
  filterPlayerId,
  onFilterPlayer,
  onSeekFrame,
}) => {
  const [tab, setTab] = useState<ReplayDrawerTab>('stats');

  const goals = useMemo(
    () => [...goalEvents].sort((a, b) => a.tick - b.tick),
    [goalEvents]
  );
  const shots = useMemo(
    () => [...shotEvents].sort((a, b) => a.tick - b.tick),
    [shotEvents]
  );

  const windowedLogs = useMemo(
    () => logsAroundTick(filterLogsByPlayer(logs, filterPlayerId), currentFrame),
    [logs, filterPlayerId, currentFrame]
  );

  const filterParts = filterPlayerId ? matchPlayerFromKey(filterPlayerId) : null;

  const challengerName = match?.challengerTacticName ?? match?.challengerName ?? 'Challenger';
  const opponentName = match?.opponentTacticName ?? match?.opponentName ?? 'Opponent';
  // Resolved kit law (stories 7.4 + 7.6): challenger wears home, opponent
  // away — a same-primary opponent changes into its OWN secondary, a
  // practice opponent keeps the default palette
  const { homeHex, awayHex } = resolveMatchKits(
    {
      colorPrimary: match?.challengerColorPrimary,
      colorSecondary: match?.challengerColorSecondary,
    },
    {
      colorPrimary: match?.opponentColorPrimary,
      colorSecondary: match?.opponentColorSecondary,
    }
  );
  // Event paint (badges, chips, discs, stat values) rides on the resolved
  // kits — no static palette anywhere in the drawer
  const teamColor: Record<MatchTeam, string> = { challenger: homeHex, opponent: awayHex };
  const dateLabel = useMemo(() => {
    const createdAt = match?.createdAt;
    if (!createdAt) return null;
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime())
      ? null
      : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [match]);

  // Telemetry derivations (story 7.9) — all from the engine's stats block
  const teamStats = stats?.teams ?? null;
  const possessionShare = useMemo(() => {
    if (!teamStats) return null;
    const total = teamStats.challenger.possessionTicks + teamStats.opponent.possessionTicks;
    if (total === 0) return { challenger: 50, opponent: 50 };
    const challenger = Math.round((teamStats.challenger.possessionTicks / total) * 100);
    return { challenger, opponent: 100 - challenger };
  }, [teamStats]);

  const statRows = useMemo(() => {
    if (!teamStats) return null;
    const row = (
      label: string,
      l: number,
      r: number,
      sub?: string
    ): { label: string; l: number; r: number; sub?: string } => ({ label, l, r, sub });
    // Shot law (Pelo, 2026-09-22): a tir IS an on-target kick; every other
    // kick is a passe. The pass success rate = completed / attempted.
    const passRate = (completed: number | undefined, attempted: number | undefined): string => {
      if (!attempted) return '—';
      return `${Math.round(((completed ?? 0) / attempted) * 100)}%`;
    };
    return [
      row('Tirs', teamStats.challenger.shots, teamStats.opponent.shots, 'cadrés uniquement'),
      row(
        'Passes',
        teamStats.challenger.passes ?? 0,
        teamStats.opponent.passes ?? 0,
        `réussite ${passRate(teamStats.challenger.passesCompleted, teamStats.challenger.passes)} · ${passRate(
          teamStats.opponent.passesCompleted,
          teamStats.opponent.passes
        )}`
      ),
      row('Récups', teamStats.challenger.turnovers, teamStats.opponent.turnovers, 'changements de camp'),
    ];
  }, [teamStats]);

  const rankedPlayers = useMemo(() => {
    if (!stats) return null;
    return [...stats.players].sort((a, b) => b.distance - a.distance);
  }, [stats]);
  const maxDistance = rankedPlayers?.[0]?.distance ?? 0;

  return (
    <aside
      style={
        {
          ...styles.drawer,
          // Story 7.4 law: team colors paint the team — the drawer's accents
          // follow the match's customization, with token defaults as fallback
          '--home-accent': homeHex,
          '--away-accent': awayHex,
        } as React.CSSProperties
      }
      data-testid="replay-drawer"
    >
      <div style={styles.tabs} role="tablist" aria-label="Panneau du replay">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'logs'}
          data-testid="drawer-tab-logs"
          onClick={() => setTab('logs')}
          style={{ ...styles.tab, ...(tab === 'logs' ? styles.tabOn : null) }}
        >
          Logs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stats'}
          data-testid="drawer-tab-stats"
          onClick={() => setTab('stats')}
          style={{ ...styles.tab, ...(tab === 'stats' ? styles.tabOn : null) }}
        >
          Stats
        </button>
      </div>

      {tab === 'stats' ? (
        <div style={styles.statList} data-testid="drawer-stats-panel">
          {/* S1 VS header — names in their colors + live score + minute */}
          <div style={styles.vsHead}>
            <div style={styles.vsTeam}>
              <span
                style={{ ...styles.crest, background: withAlpha(homeHex) }}
                aria-hidden="true"
              >
                {match?.challengerCrest ?? ''}
              </span>
              <span style={styles.vsName}>{challengerName}</span>
            </div>
            <div style={styles.vsCenter}>
              <span style={styles.vsScore} data-testid="drawer-score">
                {score.challenger} – {score.opponent}
              </span>
              <span style={styles.minuteChip} data-testid="drawer-minute">
                {formatTime(currentFrame)}
              </span>
            </div>
            <div style={styles.vsTeam}>
              <span style={{ ...styles.crest, background: withAlpha(awayHex) }} aria-hidden="true">
                {match?.opponentCrest ?? ''}
              </span>
              <span style={styles.vsName}>{opponentName}</span>
            </div>
          </div>

          {teamStats && possessionShare ? (
            <>
              {/* S1 possession card — engine truth, not heuristics */}
              <div style={styles.card} data-testid="telemetry-live">
                <span style={styles.sectit}>Possession</span>
                <div style={styles.dbar}>
                  <div style={{ ...styles.dbarL, width: `${possessionShare.challenger}%` }} />
                  <div style={styles.dbarR} />
                </div>
                <div style={styles.dnums}>
                  <span>{possessionShare.challenger}%</span>
                  <small>temps de contrôle réel</small>
                  <span>{possessionShare.opponent}%</span>
                </div>
                <PossessionSparkline
                  timeline={stats?.possessionTimeline ?? []}
                  goals={goals}
                  currentFrame={currentFrame}
                />
              </div>

              {/* S1 mirrored stat rows */}
              {statRows?.map((row) => {
                const max = Math.max(row.l, row.r, 1);
                return (
                  <div key={row.label} style={styles.statrow} data-testid={`stat-row-${row.label}`}>
                    <span style={styles.statLabel}>{row.label}</span>
                    <span style={{ ...styles.statValue, color: teamColor.challenger }}>
                      {row.l}
                    </span>
                    <div style={styles.statMid}>
                      <div style={styles.mbar}>
                        <i style={{ ...styles.mbarL, width: `${(row.l / max) * 100}%` }} />
                        <i style={{ ...styles.mbarR, width: `${(row.r / max) * 100}%` }} />
                      </div>
                      {row.sub && <span style={styles.hintline}>{row.sub}</span>}
                    </div>
                    <span style={{ ...styles.statValue, color: teamColor.opponent }}>
                      {row.r}
                    </span>
                  </div>
                );
              })}

              {/* S1 distance ranking */}
              {rankedPlayers && rankedPlayers.length > 0 && (
                <div style={styles.card}>
                  <span style={styles.sectit}>Distance parcourue</span>
                  {rankedPlayers.map((player) => (
                    <div
                      key={`${player.team}-${player.slot}`}
                      style={styles.playerRow}
                      data-testid={`distance-row-${player.team}-${player.slot}`}
                    >
                      <span
                        style={{ ...styles.playerDisc, background: teamColor[player.team] }}
                      >
                        {player.slot}
                      </span>
                      <span
                        style={styles.playerKm}
                        data-testid={`distance-value-${player.team}-${player.slot}`}
                      >
                        {formatDistance(player.distance)}
                      </span>
                      <span style={styles.kmBar}>
                        <i
                          style={{
                            width: `${maxDistance > 0 ? (player.distance / maxDistance) * 100 : 0}%`,
                            background: teamColor[player.team],
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Telemetry ghost states (older replays, story 7.9 degradation):
               the engine has not emitted a stats block — no invented numbers */
            <div style={styles.card} data-testid="telemetry-ghost">
              <span style={styles.sectit}>Télémétrie</span>
              {['Possession', 'Tirs', 'Passes', 'Récups', 'Distance'].map((label) => (
                <div key={label} style={styles.ghostRow}>
                  <span style={styles.ghostLabel}>{label}</span>
                  <span style={styles.ghostPill}>à venir</span>
                </div>
              ))}
              <span style={styles.hintline}>
                Ce match n'a pas de télémétrie moteur — rejouez-le pour l'obtenir (story 7.9).
              </span>
            </div>
          )}

          {/* Honest aggregate: the goals list, each row jumps to its frame */}
          <div style={styles.card}>
            <span style={styles.sectit}>Buts</span>
            {goals.length === 0 ? (
              <span style={styles.hintline} data-testid="goals-empty">
                Aucun but pour l'instant
              </span>
            ) : (
              <div data-testid="stat-goals-list">
                {goals.map((goal, i) => (
                  <button
                    key={`${goal.tick}-${goal.team}-${goal.scorerSlot}`}
                    type="button"
                    style={styles.goalRow}
                    data-testid={`goal-event-${i}`}
                    title={`Revenir à la frame ${goal.tick}`}
                    onClick={() => onSeekFrame(goal.tick)}
                  >
                    <span style={styles.goalMin}>{formatTime(goal.tick)}</span>
                    <span
                      style={{ ...styles.badge, background: teamColor[goal.team] }}
                    >
                      BUT
                    </span>
                    <span style={styles.goalText}>
                      {goal.scorerSlot !== null ? `#${goal.scorerSlot}` : 'csc'} ·{' '}
                      {goal.team === 'challenger' ? challengerName : opponentName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={styles.logList} data-testid="drawer-logs-panel">
          {/* Events: goals + shots, always visible, click → seek */}
          {goals.map((goal, i) => (
            <button
              key={`log-goal-${goal.tick}-${goal.team}-${goal.scorerSlot}`}
              type="button"
              style={{ ...styles.logRow, ...styles.logRowEvent }}
              data-testid={`log-goal-${i}`}
              onClick={() => onSeekFrame(goal.tick)}
            >
              <span style={styles.logMin}>{formatTime(goal.tick)}</span>
              <span style={{ ...styles.badge, background: teamColor[goal.team] }}>
                BUT
              </span>
              <span style={styles.logText}>
                {goal.scorerSlot !== null ? `#${goal.scorerSlot}` : 'csc'} ·{' '}
                {goal.team === 'challenger' ? challengerName : opponentName}
              </span>
            </button>
          ))}
          {shots.map((shot, i) => (
            <button
              key={`log-shot-${shot.tick}-${shot.event.team}-${shot.event.shooterSlot}-${i}`}
              type="button"
              style={styles.logRow}
              data-testid={`log-shot-${i}`}
              title={`Revenir à la frame ${shot.tick}`}
              onClick={() => onSeekFrame(shot.tick)}
            >
              <span style={styles.logMin}>{formatTime(shot.tick)}</span>
              {shot.event.onTarget ? (
                <span style={{ ...styles.badge, background: teamColor[shot.event.team] }}>
                  TIR
                </span>
              ) : (
                <span style={styles.badgeGhost}>PASSE</span>
              )}
              <span style={styles.logText}>
                #{shot.event.shooterSlot} ·{' '}
                {shot.event.team === 'challenger' ? challengerName : opponentName}
              </span>
            </button>
          ))}

          {filterParts && (
            <div style={styles.filterBar}>
              <span
                style={styles.filterIndicator}
                role="status"
                data-testid="log-filter-indicator"
              >
                Joueur #{filterParts.slot} ({filterParts.team}) uniquement
              </span>
              <button
                type="button"
                style={styles.filterPill}
                data-testid="log-show-all"
                onClick={() => onFilterPlayer(null)}
              >
                Tous
              </button>
            </div>
          )}

          {windowedLogs.length === 0 ? (
            <div style={styles.logEmpty} data-testid="logs-empty">
              {logs.length === 0
                ? 'Cette IA n’a rien loggé'
                : 'Aucun log à cette frame (±1s)'}
            </div>
          ) : (
            windowedLogs.map((entry) => (
              <div
                key={entry.index}
                style={styles.logRow}
                data-testid={`log-row-${entry.index}`}
                data-tick={entry.tick}
              >
                <span style={styles.logMin}>{formatTime(entry.tick)}</span>
                {entry.slot > 0 ? (
                  <button
                    type="button"
                    style={{
                      ...styles.playerChip,
                      background: teamColor[entry.team],
                    }}
                    data-testid={`log-chip-${entry.index}`}
                    title={`Filtrer sur #${entry.slot} (${entry.team})`}
                    onClick={() => onFilterPlayer(matchPlayerKey(entry.team, entry.slot))}
                  >
                    #{entry.slot}
                  </button>
                ) : (
                  // Engine system entries carry the sentinel slot 0 — they
                  // come from no player, so no player chip
                  <span style={styles.sysBadge}>SYS</span>
                )}
                {/* Engine event type badge (story 3.10): warn/error entries
                    carry their type (MULTIPLE_ACTIONS, SCRIPT_ERROR...) so
                    the stream stays attributable at a glance */}
                {entry.level !== 'log' && <span style={styles.typeBadge}>{entry.type}</span>}
                <span
                  style={{
                    ...styles.logText,
                    color:
                      entry.level === 'error'
                        ? 'var(--corail)'
                        : entry.level === 'warn'
                          ? 'var(--sun)'
                          : undefined,
                  }}
                  title={entry.message}
                >
                  {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <div style={styles.metaFoot} data-testid="drawer-meta">
        <span style={styles.metaMono}>
          {match ? (MODE_LABELS[match.mode] ?? match.mode) : '—'}
        </span>
        <span>· {formatFrameCount(totalFrames)} frames</span>
        {dateLabel && <span>· {dateLabel}</span>}
      </div>
    </aside>
  );
};

/** S1 possession sparkline: per-bin challenger share, goal dots, playhead */
const PossessionSparkline: React.FC<{
  timeline: number[];
  goals: GoalEventEntry[];
  currentFrame: number;
}> = ({ timeline, goals, currentFrame }) => {
  if (timeline.length === 0) return null;
  const x = (bin: number) => ((bin + 0.5) / timeline.length) * SPARK_WIDTH;
  const y = (share: number) => SPARK_HEIGHT - (share / 100) * SPARK_HEIGHT;

  const topPath = timeline.map((share, bin) => `${x(bin)},${y(share)}`).join(' L');
  const goalDots = goals
    .map((goal) => {
      const bin = Math.min(Math.floor(goal.tick / POSSESSION_BIN_TICKS), timeline.length - 1);
      const dotX = x(bin);
      const dotY = y(timeline[bin] ?? 50);
      return (
        <circle
          key={`${goal.tick}-${goal.team}`}
          cx={dotX}
          cy={dotY}
          r={3.5}
          fill={goal.team === 'challenger' ? 'var(--sun)' : 'var(--corail)'}
          stroke="var(--panel)"
          strokeWidth={2}
        />
      );
    });

  const playheadBin = Math.min(
    Math.floor(currentFrame / POSSESSION_BIN_TICKS),
    timeline.length - 1
  );

  return (
    <svg
      style={styles.spark}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      data-testid="possession-sparkline"
    >
      <path d={`M0,0 L${topPath} L${SPARK_WIDTH},0 Z`} fill="var(--home-accent, #e4573f)" opacity={0.85} />
      <path
        d={`M0,${SPARK_HEIGHT} L${topPath} L${SPARK_WIDTH},${SPARK_HEIGHT} Z`}
        fill="var(--away-accent, #3d8fd1)"
        opacity={0.85}
      />
      {goalDots}
      <line
        x1={x(playheadBin)}
        y1={0}
        x2={x(playheadBin)}
        y2={SPARK_HEIGHT}
        stroke="#fff"
        strokeWidth={2}
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.35))' }}
      />
    </svg>
  );
};

/** Formats a frame count as a plain grouped integer (10 800) */
function formatFrameCount(totalFrames: number): string {
  if (!Number.isFinite(totalFrames) || totalFrames <= 0) return '0';
  return Math.floor(totalFrames).toLocaleString('fr-FR');
}

/** Field units → meters, km with a French decimal comma past 999 m */
function formatDistance(units: number): string {
  if (!Number.isFinite(units) || units <= 0) return '0 m';
  if (units >= 1000) {
    return `${(units / 1000).toFixed(1).replace('.', ',')} km`;
  }
  return `${Math.round(units)} m`;
}

/** 6-digit hex → 8-digit with alpha (17%); anything else passes through */
function withAlpha(hex: string | null | undefined): string {
  if (!hex) return 'var(--panel2)';
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}2b` : hex;
}

const styles: Record<string, React.CSSProperties> = {
  drawer: {
    width: 300,
    flex: 'none',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    background: 'var(--panel)',
    borderRadius: 'var(--r)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
  },
  tabs: {
    height: 44,
    flex: 'none',
    display: 'flex',
    borderBottom: '1px solid var(--line)',
  },
  tab: {
    flex: 1,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.07em',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    borderRadius: 0,
  },
  tabOn: {
    color: 'var(--ink)',
    boxShadow: 'inset 0 -2.5px 0 var(--corail)',
  },
  statList: {
    flex: 1,
    overflow: 'auto',
    padding: '12px 12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  vsHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '4px 2px 2px',
  },
  vsTeam: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
  },
  vsCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 'none',
  },
  crest: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    fontSize: 19,
    boxShadow: 'var(--shadow)',
  },
  vsName: {
    fontSize: 10.5,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  vsScore: {
    fontFamily: 'var(--mono)',
    fontWeight: 700,
    fontSize: 21,
  },
  minuteChip: {
    fontSize: 9.5,
    fontWeight: 800,
    background: 'var(--panel2)',
    borderRadius: 99,
    padding: '2px 8px',
    color: 'var(--muted)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    fontFamily: 'var(--mono)',
  },
  card: {
    background: 'var(--panel2)',
    borderRadius: 14,
    padding: '11px 12px',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectit: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  },
  dbar: {
    height: 12,
    borderRadius: 99,
    overflow: 'hidden',
    display: 'flex',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  dbarL: {
    background: 'var(--home-accent, #e4573f)',
    height: '100%',
  },
  dbarR: {
    background: 'var(--away-accent, #3d8fd1)',
    flex: 1,
    height: '100%',
  },
  dnums: {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: 'var(--mono)',
    fontSize: 12,
    fontWeight: 700,
  },
  spark: {
    width: '100%',
    display: 'block',
  },
  statrow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 13,
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--muted)',
    letterSpacing: '0.04em',
    width: 64,
    flex: 'none',
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: 'var(--mono)',
    fontSize: 12.5,
    fontWeight: 700,
    flex: 'none',
    width: 22,
    textAlign: 'center',
  },
  statMid: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  mbar: {
    height: 6,
    borderRadius: 99,
    background: 'var(--line)',
    position: 'relative',
    overflow: 'hidden',
  },
  mbarL: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '50%',
    background: 'var(--home-accent, #e4573f)',
    borderRadius: 99,
  },
  mbarR: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    background: 'var(--away-accent, #3d8fd1)',
    borderRadius: 99,
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 6px',
    borderRadius: 10,
    fontSize: 11.5,
  },
  playerDisc: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    fontSize: 10,
    color: '#fff',
    flex: 'none',
  },
  playerKm: {
    fontFamily: 'var(--mono)',
    fontSize: 10.5,
    color: 'var(--muted)',
    flex: 'none',
    width: 48,
  },
  kmBar: {
    flex: 1,
    height: 5,
    borderRadius: 99,
    background: 'var(--line)',
    position: 'relative',
    overflow: 'hidden',
  },
  ghostRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ghostLabel: {
    fontSize: 11.5,
    fontWeight: 600,
    color: 'var(--muted)',
  },
  ghostPill: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    background: 'var(--panel)',
    borderRadius: 99,
    padding: '2px 8px',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  hintline: {
    fontSize: 10.5,
    color: 'var(--muted)',
    lineHeight: 1.5,
  },
  goalRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 9px',
    borderRadius: 11,
    fontSize: 12,
    textAlign: 'left',
    width: '100%',
  },
  goalMin: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--muted)',
    flex: 'none',
    width: 34,
  },
  badge: {
    flex: 'none',
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 7px',
    borderRadius: 7,
    letterSpacing: '0.05em',
    color: '#12241b',
  },
  badgeGhost: {
    flex: 'none',
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 7px',
    borderRadius: 7,
    letterSpacing: '0.05em',
    color: 'var(--muted)',
    background: 'var(--panel)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  goalText: {
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logList: {
    flex: 1,
    overflow: 'auto',
    padding: 9,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  logRow: {
    display: 'flex',
    gap: 9,
    padding: '8px 10px',
    borderRadius: 12,
    fontSize: 12,
    lineHeight: 1.5,
    alignItems: 'flex-start',
    textAlign: 'left',
    width: '100%',
  },
  logRowEvent: {
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  logMin: {
    flex: 'none',
    fontWeight: 800,
    color: 'var(--muted)',
    fontSize: 11,
    width: 34,
    paddingTop: 1,
    fontFamily: 'var(--mono)',
  },
  logText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playerChip: {
    flex: 'none',
    fontSize: 9.5,
    fontWeight: 800,
    padding: '2px 7px',
    borderRadius: 7,
    color: '#12241b',
  },
  sysBadge: {
    flex: 'none',
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 7,
    color: 'var(--muted)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  typeBadge: {
    flex: 'none',
    fontSize: 8.5,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 7,
    letterSpacing: '0.04em',
    color: 'var(--muted)',
    background: 'var(--panel)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '2px 4px',
  },
  filterIndicator: {
    fontSize: 10.5,
    color: 'var(--muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  filterPill: {
    flex: 'none',
    fontSize: 10,
    fontWeight: 800,
    padding: '3px 10px',
    borderRadius: 99,
    color: 'var(--muted)',
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  logEmpty: {
    fontSize: 11.5,
    fontStyle: 'italic',
    color: 'var(--muted)',
    padding: '6px 4px',
  },
  metaFoot: {
    flex: 'none',
    borderTop: '1px solid var(--line)',
    padding: '9px 14px',
    fontSize: 10.5,
    color: 'var(--muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  metaMono: {
    fontFamily: 'var(--mono)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontSize: 10,
  },
};
