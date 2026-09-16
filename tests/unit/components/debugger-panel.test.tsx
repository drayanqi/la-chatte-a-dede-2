/**
 * DebuggerPanel Component Unit Tests
 *
 * Watch list (story 3.7 selection work):
 * - Nothing selected: all roster players shown with live state
 * - A player selected: only that player is shown
 * - Live frame states join onto roster entries by engine player id
 * - Selected player missing from roster shows the empty state
 *
 * Replay logs (story 3.10):
 * - Real frame logs render windowed around the playhead, no manual step
 * - Player chips are color-coded by team, levels styled with type badges
 * - Empty states distinguish "never logged" from "quiet tick"
 * - Manual scroll disables auto-follow; the follow pill re-enables it
 *
 * @see Epic 3: Practice Mode & Match Experience
 * @see spec-player-selection-debugger-filter.md
 * @see 3-10-debug-panel-log-display.md
 * @priority P1
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { DebuggerPanel } from '@/components/debugger/DebuggerPanel';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTacticsStore } from '@/stores/tacticsStore';
import { useMatchStore } from '@/stores/matchStore';
import type { ReplayLogEntry } from '@/lib/replayLogs';
import type { TacticConfig, PlayerFrameState, MatchTeam, MatchFrame } from '@/types';

const makeTactic = (slots: number[]): TacticConfig =>
  ({
    id: 'tactic-1',
    name: 'Tactic 1',
    isSystem: false,
    players: slots.map((slot) => ({
      playerSlot: slot,
      positionX: 10 * slot,
      positionY: 5 * slot,
      scriptId: null,
    })),
  }) as unknown as TacticConfig;

const seedTactics = (tactic: TacticConfig | null) => {
  useTacticsStore.setState({
    tactics: tactic ? [tactic] : [],
    activeTacticId: tactic ? tactic.id : null,
    tacticsError: null,
  });
};

const seedCanvas = (
  selectedPlayerId: string | null,
  playerStates: PlayerFrameState[] = []
) => {
  useCanvasStore.setState({ selectedPlayerId, playerStates });
};

const frameState = (playerId: string, x: number, y: number): PlayerFrameState => ({
  playerId,
  position: { x, y },
  velocity: { vx: 0, vy: 0 },
  state: 'moving',
});

describe('DebuggerPanel — Watch list', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
    useTacticsStore.getState().reset();
    useMatchStore.getState().reset();
  });

  it('shows every roster player when nothing is selected', () => {
    // GIVEN: A loaded tactic with 5 players and no selection
    seedTactics(makeTactic([1, 2, 3, 4, 5]));
    seedCanvas(null);

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: All five players are listed
    expect(screen.getByTestId('debug-watch-list')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-row-home-0')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-row-home-1')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-row-home-2')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-row-home-3')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-row-home-4')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-title')).toHaveTextContent(
      'tous les joueurs'
    );
  });

  it('shows only the selected player when one is selected', () => {
    // GIVEN: A loaded tactic and a selected player
    seedTactics(makeTactic([1, 2, 3, 4, 5]));
    seedCanvas('home-1');

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: Only that player's row is rendered
    expect(screen.getByTestId('debug-watch-row-home-1')).toBeInTheDocument();
    expect(screen.queryByTestId('debug-watch-row-home-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('debug-watch-row-home-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-title')).toHaveTextContent('P2');
  });

  it('joins live frame states onto roster entries by player id', () => {
    // GIVEN: Live states only for home-0 and home-2
    seedTactics(makeTactic([1, 2, 3, 4, 5]));
    seedCanvas(null, [
      frameState('home-0', 12.34, 5.67),
      frameState('home-2', 40, 50),
    ]);

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: Positioned rows show live values, others show the placeholder
    expect(screen.getByTestId('debug-watch-row-home-0')).toHaveTextContent(
      '(12.3, 5.7)'
    );
    expect(screen.getByTestId('debug-watch-row-home-2')).toHaveTextContent(
      '(40.0, 50.0)'
    );
    expect(screen.getByTestId('debug-watch-row-home-1')).toHaveTextContent('—');
  });

  it('shows the empty state when no tactic is loaded', () => {
    // GIVEN: No tactic and no selection
    seedTactics(null);
    seedCanvas(null);

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: The empty state is displayed
    expect(screen.getByTestId('debug-watch-empty')).toBeInTheDocument();
  });

  it('shows the empty state when the selected player is not on the roster', () => {
    // GIVEN: A tactic without a matching selected id
    seedTactics(makeTactic([1, 2, 3, 4, 5]));
    seedCanvas('away-3');

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: The empty state is displayed instead of a row
    expect(screen.getByTestId('debug-watch-empty')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Replay logs (story 3.10)
// ---------------------------------------------------------------------------

const replayLog = (
  index: number,
  tick: number,
  overrides: Partial<Omit<ReplayLogEntry, 'index' | 'tick'>> = {}
): ReplayLogEntry => ({
  index,
  tick,
  team: 'challenger',
  slot: 1,
  level: 'log',
  type: 'CONSOLE',
  message: `msg ${index}`,
  ...overrides,
});

/** One log every 10 ticks from 40 to 160, alternating players/teams */
const buildWindowedLogs = (): ReplayLogEntry[] => {
  const logs: ReplayLogEntry[] = [];
  for (let i = 0; i < 13; i++) {
    const tick = 40 + i * 10;
    const team: MatchTeam = i % 2 === 0 ? 'challenger' : 'opponent';
    logs.push(replayLog(i, tick, { team, slot: (i % 5) + 1 }));
  }
  return logs;
};

/** Minimal frame placeholder — only its presence in the store matters here */
const makeFrame = (index: number): MatchFrame =>
  ({ index, ball: { x: 50, y: 25 }, players: [], events: [] }) as unknown as MatchFrame;

describe('DebuggerPanel — Replay logs', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
    useTacticsStore.getState().reset();
    useMatchStore.getState().reset();
  });

  it('renders log entries around the playhead with tick, player tag and message', () => {
    // GIVEN: Replay logs and the playhead at tick 100
    useMatchStore.setState({ replayLogs: buildWindowedLogs() });
    useCanvasStore.setState({ currentFrame: 100 });

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: Entries render automatically (no start-debugging step) and each
    // shows the tick, the P-tag and the message
    expect(screen.getByTestId('debug-log-panel')).toBeInTheDocument();
    const entry = screen.getByTestId('debug-log-entry-5');
    expect(entry).toHaveTextContent('#90');
    expect(entry).toHaveTextContent('P1');
    expect(entry).toHaveTextContent('msg 5');
    // The pre-3.10 fake console machinery is gone
    expect(screen.queryByText('🐛 Debug')).not.toBeInTheDocument();
  });

  it('only renders the ±60-tick window, not the full log set', () => {
    // GIVEN: Logs from tick 0 to 5000 and a playhead at tick 2500
    const logs: ReplayLogEntry[] = [];
    for (let tick = 0; tick <= 5000; tick += 10) {
      logs.push(replayLog(logs.length, tick));
    }
    useMatchStore.setState({ replayLogs: logs });
    useCanvasStore.setState({ currentFrame: 2500 });

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: Only the windowed entries are in the DOM (6 per side + self
    // for a step-10 fixture: ticks 2440..2560)
    const entries = screen.getAllByTestId(/^debug-log-entry-\d+$/);
    expect(entries.length).toBe(13);
  });

  it('color-codes the player chip by team to match the pitch', () => {
    // GIVEN: One challenger and one opponent log entry in the window
    useMatchStore.setState({
      replayLogs: [
        replayLog(0, 100, { team: 'challenger', slot: 2 }),
        replayLog(1, 101, { team: 'opponent', slot: 4 }),
      ],
    });
    useCanvasStore.setState({ currentFrame: 100 });

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: The chips carry the challenger orange / opponent blue colors
    const challengerChip = within(screen.getByTestId('debug-log-entry-0')).getByText('P2');
    expect(challengerChip).toHaveStyle({ backgroundColor: '#ff6b1a' });
    const opponentChip = within(screen.getByTestId('debug-log-entry-1')).getByText('P4');
    expect(opponentChip).toHaveStyle({ backgroundColor: '#1a8cff' });
  });

  it('styles warn and error entries with level colors and a type badge', () => {
    // GIVEN: One entry per level (3.4 warnings taxonomy)
    useMatchStore.setState({
      replayLogs: [
        replayLog(0, 100, { level: 'log', type: 'CONSOLE', message: 'normal' }),
        replayLog(1, 100, {
          level: 'warn',
          type: 'MULTIPLE_ACTIONS',
          message: 'only the first action per tick is applied',
        }),
        replayLog(2, 100, { level: 'error', type: 'SCRIPT_ERROR', message: 'boom' }),
      ],
    });
    useCanvasStore.setState({ currentFrame: 100 });

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: Message colors follow the level palette (normal / --warning / --error)
    const logEntry = screen.getByTestId('debug-log-entry-0');
    expect(within(logEntry).getByText('normal')).toHaveStyle({ color: '#cccccc' });
    const warnEntry = screen.getByTestId('debug-log-entry-1');
    expect(
      within(warnEntry).getByText('only the first action per tick is applied')
    ).toHaveStyle({ color: '#dcdcaa' });
    const errorEntry = screen.getByTestId('debug-log-entry-2');
    expect(within(errorEntry).getByText('boom')).toHaveStyle({ color: '#f14c4c' });

    // ...warn/error entries show a type badge, plain console entries do not
    expect(within(warnEntry).getByText('MULTIPLE_ACTIONS')).toBeInTheDocument();
    expect(within(errorEntry).getByText('SCRIPT_ERROR')).toBeInTheDocument();
    expect(within(logEntry).queryByText('CONSOLE')).not.toBeInTheDocument();
  });

  it('shows the never-logged empty state when the replay has no logs', () => {
    // GIVEN: A loaded replay whose AI never called console.log
    useMatchStore.setState({ replayFrames: [makeFrame(0)], replayLogs: [] });
    useCanvasStore.setState({ currentFrame: 42 });

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: The distinct "never logged" empty state is shown
    expect(screen.getByTestId('debug-log-empty')).toHaveTextContent('This AI never logged');
  });

  it('shows the no-replay empty state when no replay is loaded at all', () => {
    // GIVEN: The panel mounted in edit mode — no replay frames in the store
    useMatchStore.setState({ replayFrames: [], replayLogs: [] });
    useCanvasStore.setState({ currentFrame: 42 });

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: The panel does not claim anything about an AI that never ran
    expect(screen.getByTestId('debug-log-empty')).toHaveTextContent('No replay loaded');
  });

  it('shows the quiet-tick empty state when logs exist outside the window', () => {
    // GIVEN: Logs only at tick 0, playhead far away
    useMatchStore.setState({ replayLogs: [replayLog(0, 0)] });
    useCanvasStore.setState({ currentFrame: 5000 });

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: The quiet-tick empty state is shown instead
    expect(screen.getByTestId('debug-log-empty')).toHaveTextContent('No logs this tick');
  });

  it('disables auto-follow on manual scroll and restores it with the follow pill', () => {
    // GIVEN: Logs around the playhead, auto-follow active (no pill)
    useMatchStore.setState({ replayLogs: buildWindowedLogs() });
    useCanvasStore.setState({ currentFrame: 100 });
    render(<DebuggerPanel />);
    expect(screen.queryByTestId('debug-follow-pill')).not.toBeInTheDocument();

    // WHEN: The user scrolls the log list manually
    const list = screen.getByTestId('debug-log-list');
    Object.defineProperty(list, 'scrollTop', { configurable: true, writable: true, value: 500 });
    fireEvent.scroll(list);

    // THEN: Auto-follow is off and the follow pill appears
    const pill = screen.getByTestId('debug-follow-pill');
    expect(pill).toBeInTheDocument();

    // WHEN: Clicking the pill
    fireEvent.click(pill);

    // THEN: Auto-follow is restored (pill gone)
    expect(screen.queryByTestId('debug-follow-pill')).not.toBeInTheDocument();
  });

  it('re-enables follow when a new replay loads after a manual scroll', () => {
    // GIVEN: A replay where the user scrolled away from auto-follow
    useMatchStore.setState({ replayLogs: buildWindowedLogs() });
    useCanvasStore.setState({ currentFrame: 100 });
    render(<DebuggerPanel />);
    const list = screen.getByTestId('debug-log-list');
    Object.defineProperty(list, 'scrollTop', { configurable: true, writable: true, value: 500 });
    fireEvent.scroll(list);
    expect(screen.getByTestId('debug-follow-pill')).toBeInTheDocument();

    // WHEN: A new replay is loaded (fresh replayLogs identity)
    act(() => {
      useMatchStore.setState({ replayLogs: buildWindowedLogs() });
    });

    // THEN: The stale follow-off state is gone — the new replay is followed
    expect(screen.queryByTestId('debug-follow-pill')).not.toBeInTheDocument();
  });

  it('renders the engine LOG_CAP system warning as SYS instead of a player chip', () => {
    // GIVEN: The engine's log-cap warning carries the sentinel slot 0
    // (IsolatedScriptRunner applyLogCap) — it comes from no player
    useMatchStore.setState({
      replayLogs: [
        replayLog(0, 100, {
          level: 'warn',
          type: 'LOG_CAP',
          slot: 0,
          message: 'match log limit reached',
        }),
      ],
    });
    useCanvasStore.setState({ currentFrame: 100 });
    render(<DebuggerPanel />);

    // THEN: The entry shows the SYS badge, never a phantom P0 chip
    const entry = screen.getByTestId('debug-log-entry-0');
    expect(within(entry).getByText('SYS')).toBeInTheDocument();
    expect(within(entry).queryByText(/^P\d+$/)).not.toBeInTheDocument();
  });

  it('keeps follow enabled when the browser clamps scrollTop during a window shrink', () => {
    // GIVEN: Logs with an anchored auto-scroll — a first playhead move makes
    // the effect record the pre-shrink scrollHeight (1000)
    useMatchStore.setState({ replayLogs: buildWindowedLogs() });
    useCanvasStore.setState({ currentFrame: 100 });
    render(<DebuggerPanel />);
    const list = screen.getByTestId('debug-log-list');
    Object.defineProperty(list, 'scrollHeight', {
      configurable: true,
      writable: true,
      value: 1000,
    });
    act(() => {
      useCanvasStore.setState({ currentFrame: 110 }); // effect re-runs, records 1000
    });

    // WHEN: The content shrinks (quiet zone, scrollHeight 200) and the
    // browser clamps scrollTop to the new maximum (200 - clientHeight 0)
    act(() => {
      useCanvasStore.setState({ currentFrame: 5000 });
    });
    Object.defineProperty(list, 'scrollHeight', {
      configurable: true,
      writable: true,
      value: 200,
    });
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 200,
    });
    fireEvent.scroll(list);

    // THEN: The clamp is not mistaken for a user scroll — follow stays on
    expect(screen.queryByTestId('debug-follow-pill')).not.toBeInTheDocument();
  });

  it('still disables follow on a genuine user scroll during a window shrink', () => {
    // GIVEN: Same priming, but the scroll position ends away from the clamp
    // boundaries — that is a user scroll, not a clamp
    useMatchStore.setState({ replayLogs: buildWindowedLogs() });
    useCanvasStore.setState({ currentFrame: 100 });
    render(<DebuggerPanel />);
    const list = screen.getByTestId('debug-log-list');
    Object.defineProperty(list, 'scrollHeight', {
      configurable: true,
      writable: true,
      value: 1000,
    });
    act(() => {
      useCanvasStore.setState({ currentFrame: 110 }); // effect re-runs, records 1000
    });

    // WHEN: The content shrinks and the user is mid-scroll (not clamped)
    act(() => {
      useCanvasStore.setState({ currentFrame: 5000 });
    });
    Object.defineProperty(list, 'scrollHeight', {
      configurable: true,
      writable: true,
      value: 200,
    });
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 150,
    });
    fireEvent.scroll(list);

    // THEN: Follow is disabled and the pill appears
    expect(screen.getByTestId('debug-follow-pill')).toBeInTheDocument();
  });
});
