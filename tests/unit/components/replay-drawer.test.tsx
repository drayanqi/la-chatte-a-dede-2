/**
 * ReplayDrawer Component Unit Tests (story 7.7)
 *
 * The right drawer of the broadcast replay (S1 "Tableau de bord" design):
 * - Stats tab: VS header with live score + minute, ghost telemetry states
 *   (story 7.9 — no invented numbers), goals list linked to frames, meta
 * - Logs tab: goal rows + windowed log rows with player filter chips
 *
 * @see Story 7.7: Match View — Broadcast Replay
 * @priority P0
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ReplayDrawer } from '@/components/match/ReplayDrawer';
import { extractGoalEvents } from '@/lib/score';
import { extractLogs } from '@/lib/replayLogs';
import type { MatchEventEntry } from '@/lib/matchEvents';
import type { MatchFrame, MatchResult, MatchShotEvent, MatchStats } from '@/types';

const makeMatch = (overrides: Partial<MatchResult> = {}): MatchResult =>
  ({
    id: 'match-1',
    mode: 'ranked',
    status: 'completed',
    scoreChallenger: 2,
    scoreOpponent: 1,
    result: 'challenger_win',
    challengerName: 'Pelo',
    opponentName: 'Gégé FC',
    challengerTacticName: 'Les Roulants',
    opponentTacticName: 'Gégé FC',
    challengerCrest: '🦊',
    opponentCrest: '🤖',
    challengerColorPrimary: '#e4573f',
    challengerColorSecondary: null,
    opponentColorPrimary: '#3d8fd1',
    opponentColorSecondary: null,
    durationFrames: 10800,
    createdAt: '2026-09-21T00:00:00.000Z',
    ...overrides,
  }) as unknown as MatchResult;

/** 10 frames; a goal for #8 challenger at tick 2, a goal for #10 opponent at tick 5 */
const makeFrames = (): MatchFrame[] =>
  Array.from({ length: 10 }, (_, tick): MatchFrame => {
    const frame: MatchFrame = {
      index: tick,
      ball: { x: 50, y: 50 },
      players: [
        { slot: 8, team: 'challenger', x: 40, y: 40, state: 'idle' },
        { slot: 10, team: 'opponent', x: 60, y: 60, state: 'idle' },
      ],
      events: [],
      logs: [],
    };
    if (tick === 2) {
      frame.events = [{ type: 'goal', team: 'challenger', scorerSlot: 8 }];
      frame.logs = [{ team: 'challenger', slot: 8, level: 'log', type: 'CONSOLE', message: 'allez !' }];
    }
    if (tick === 5) {
      frame.events = [{ type: 'goal', team: 'opponent', scorerSlot: 10 }];
      frame.logs = [{ team: 'opponent', slot: 10, level: 'error', type: 'SCRIPT_ERROR', message: 'boom' }];
    }
    return frame;
  });

const renderDrawer = (overrides: Record<string, unknown> = {}) => {
  const frames = makeFrames();
  return render(
    <ReplayDrawer
      match={makeMatch()}
      score={{ challenger: 1, opponent: 1 }}
      goalEvents={extractGoalEvents(frames)}
      shotEvents={[]}
      logs={extractLogs(frames)}
      stats={null}
      currentFrame={5}
      totalFrames={10800}
      filterPlayerId={null}
      onFilterPlayer={vi.fn()}
      onSeekFrame={vi.fn()}
      {...overrides}
    />
  );
};

const seekSpy = () => vi.fn();

/** Engine-truth stats block for the live-telemetry tests (story 7.9, shot law 2026-09-22) */
const makeStats = (overrides: Partial<MatchStats> = {}): MatchStats =>
  ({
    teams: {
      challenger: { possessionTicks: 5800, shots: 3, passes: 4, passesCompleted: 2, turnovers: 14 },
      opponent: { possessionTicks: 4200, shots: 2, passes: 5, passesCompleted: 1, turnovers: 12 },
    },
    players: [
      { team: 'challenger', slot: 8, distance: 2100, shots: 2 },
      { team: 'challenger', slot: 9, distance: 1800, shots: 1 },
      { team: 'opponent', slot: 10, distance: 1900, shots: 0 },
      { team: 'opponent', slot: 8, distance: 1400, shots: 0 },
    ],
    possessionTimeline: [55, 62, 48, 40, 58],
    ...overrides,
  }) as MatchStats;

describe('ReplayDrawer', () => {
  beforeEach(() => {
    // Logs tab is not the default: start every test on Stats
  });

  it('renders the VS header with tactic names and the live score', () => {
    renderDrawer();

    expect(screen.getByTestId('replay-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-score')).toHaveTextContent('1 – 1');
    expect(screen.getByText('Les Roulants')).toBeInTheDocument();
    expect(screen.getByText('Gégé FC')).toBeInTheDocument();
    // minute chip at frame 5 = 00:00 (5/60s)
    expect(screen.getByTestId('drawer-minute')).toHaveTextContent('00:00');
  });

  it('keeps the telemetry sections as ghost states when the replay has no stats block', () => {
    renderDrawer();

    expect(screen.getByTestId('telemetry-ghost')).toBeInTheDocument();
    expect(screen.getByText('Possession')).toBeInTheDocument();
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getAllByText('à venir').length).toBe(5);
    // No invented possession number anywhere in the drawer
    expect(screen.queryByText(/%\s*$/)).not.toBeInTheDocument();
  });

  it('brings the S1 sections alive when the engine emitted stats (story 7.9)', () => {
    renderDrawer({ stats: makeStats() });

    expect(screen.getByTestId('telemetry-live')).toBeInTheDocument();
    expect(screen.queryByTestId('telemetry-ghost')).not.toBeInTheDocument();
    // Possession share from possessionTicks (5800/10000)
    expect(screen.getByText('58%')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByTestId('possession-sparkline')).toBeInTheDocument();
    // Shot law (Pelo 2026-09-22): Tirs = cadrés ONLY, no inflated count
    expect(screen.getByTestId('stat-row-Tirs')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-row-Tirs')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-row-Tirs')).toHaveTextContent('cadrés uniquement');
    // Passes with the success rate (2/4 = 50%, 1/5 = 20%)
    expect(screen.getByTestId('stat-row-Passes')).toHaveTextContent('4');
    expect(screen.getByTestId('stat-row-Passes')).toHaveTextContent('5');
    expect(screen.getByTestId('stat-row-Passes')).toHaveTextContent('réussite 50% · 20%');
    // Dribbles are not a stat anymore
    expect(screen.queryByTestId('stat-row-Dribbles')).not.toBeInTheDocument();
    expect(screen.getByTestId('stat-row-Récups')).toHaveTextContent('14');
    // Distance ranking sorted by distance; past 1000 units the formatter
    // switches to km with the French decimal comma (value asserted on its
    // own testid — the disc's slot digit would otherwise glue to it)
    const rows = screen.getAllByTestId(/^distance-row-/);
    expect(rows).toHaveLength(4);
    expect(screen.getByTestId('distance-value-challenger-8')).toHaveTextContent('2,1 km');
    expect(screen.getByTestId('distance-value-opponent-10')).toHaveTextContent('1,9 km');
    expect(screen.getByTestId('distance-value-challenger-9')).toHaveTextContent('1,8 km');
    expect(screen.getByTestId('distance-value-opponent-8')).toHaveTextContent('1,4 km');
    // Order: sorted by distance descending
    expect(rows.map((row) => row.dataset.testid)).toEqual([
      'distance-row-challenger-8',
      'distance-row-opponent-10',
      'distance-row-challenger-9',
      'distance-row-opponent-8',
    ]);
  });

  it('renders the shot rows in the Logs tab with the TIR/PASSE verdict', () => {
    const shotEvents: MatchEventEntry<MatchShotEvent>[] = [
      { tick: 120, event: { type: 'shot', team: 'challenger', shooterSlot: 8, onTarget: true } },
      { tick: 240, event: { type: 'shot', team: 'opponent', shooterSlot: 10, onTarget: false } },
    ];
    const onSeekFrame = seekSpy();
    renderDrawer({ currentFrame: 120, shotEvents, onSeekFrame });

    fireEvent.click(screen.getByTestId('drawer-tab-logs'));
    const shotRows = screen.getAllByTestId(/^log-shot-/);
    expect(shotRows).toHaveLength(2);
    // Shot law: on-target = TIR, off-target = PASSE (no "non cadré" tir)
    expect(shotRows[0]).toHaveTextContent('TIR');
    expect(shotRows[0]).toHaveTextContent('#8');
    expect(shotRows[1]).toHaveTextContent('PASSE');
    expect(shotRows[1]).toHaveTextContent('#10');

    fireEvent.click(shotRows[1]);
    expect(onSeekFrame).toHaveBeenCalledWith(240);
  });

  it('lists the goals with minute and scorer and seeks on click', () => {
    const onSeekFrame = seekSpy();
    renderDrawer({ onSeekFrame });

    const rows = screen.getAllByTestId(/^goal-event-/);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('#8');
    expect(rows[1]).toHaveTextContent('#10');

    fireEvent.click(rows[1]);
    expect(onSeekFrame).toHaveBeenCalledWith(5);
  });

  it('shows the honest match meta (mode, frames, date)', () => {
    renderDrawer();

    const meta = screen.getByTestId('drawer-meta');
    expect(meta).toHaveTextContent('Classé');
    expect(meta).toHaveTextContent('10 800 frames');
    expect(meta).toHaveTextContent('2026');
  });

  it('switches to the Logs tab with goal rows and windowed logs', () => {
    renderDrawer({ currentFrame: 5 });

    fireEvent.click(screen.getByTestId('drawer-tab-logs'));

    // Goals stay visible in Logs too, still seekable
    const goalRows = screen.getAllByTestId(/^log-goal-/);
    expect(goalRows).toHaveLength(2);

    // Windowed around frame 5 (±60 ticks): both log entries are in window
    expect(screen.getAllByTestId(/^log-row-/)).toHaveLength(2);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('filters the logs by player chip and restores with "Tous"', () => {
    const onFilterPlayer = vi.fn();
    renderDrawer({ currentFrame: 5, onFilterPlayer });

    fireEvent.click(screen.getByTestId('drawer-tab-logs'));
    // The error log belongs to opponent #10 → its chip is rendered
    const chip = screen.getAllByTestId(/^log-row-/)[1].querySelector('button');
    expect(chip).not.toBeNull();
    fireEvent.click(chip!);
    // The filter lives in the canvas store (pitch-selection sync, 3.11):
    // the drawer only reports the intent upward
    expect(onFilterPlayer).toHaveBeenCalledWith('opponent-10');
  });

  it('shows the live filter indicator, filters the stream, and resets with "Tous"', () => {
    const onFilterPlayer = vi.fn();
    const frames = makeFrames();
    renderDrawer({
      currentFrame: 5,
      onFilterPlayer,
      filterPlayerId: 'opponent-10',
      logs: extractLogs(frames),
    });

    fireEvent.click(screen.getByTestId('drawer-tab-logs'));
    expect(screen.getByTestId('log-filter-indicator')).toHaveTextContent('#10 (opponent)');
    // Only the filtered player's rows survive
    const rows = screen.getAllByTestId(/^log-row-/);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('boom');

    // "Tous" resets upward with null
    fireEvent.click(screen.getByTestId('log-show-all'));
    expect(onFilterPlayer).toHaveBeenCalledWith(null);
  });

  it('falls back to default names when the match is absent', () => {
    renderDrawer({ match: null });

    expect(screen.getByText('Challenger')).toBeInTheDocument();
    expect(screen.getByText('Opponent')).toBeInTheDocument();
    // Meta without a match: mode placeholder only
    expect(screen.getByTestId('drawer-meta')).toHaveTextContent('—');
  });

  it('paints the resolved kits when both sides share a primary (away wears its OWN secondary)', () => {
    renderDrawer({
      match: makeMatch({
        challengerColorPrimary: '#e4573f',
        opponentColorPrimary: '#e4573f',
        opponentColorSecondary: '#ffc244',
      }),
    });

    // Drawer accents follow the kit law: challenger keeps its primary, the
    // same-primary opponent changes into its secondary
    const drawer = screen.getByTestId('replay-drawer');
    expect(drawer.style.getPropertyValue('--home-accent')).toBe('#e4573f');
    expect(drawer.style.getPropertyValue('--away-accent')).toBe('#ffc244');

    // Goal badges wear the resolved kits, not a static palette
    // (jsdom normalizes the background shorthand to rgb(...))
    const challengerBadge = within(screen.getByTestId('goal-event-0')).getByText('BUT');
    expect(challengerBadge.style.background).toBe('rgb(228, 87, 63)');
    const opponentBadge = within(screen.getByTestId('goal-event-1')).getByText('BUT');
    expect(opponentBadge.style.background).toBe('rgb(255, 194, 68)');
  });
});
