/**
 * MatchPage Unit Tests (story 7.7)
 *
 * The broadcast replay page, with the canvas stubbed (jsdom-hostile):
 * - loading / error / ready states
 * - the broadcast score pill (names, live score, minute, frame counter)
 * - the celebration overlay: live goal -> playback pause + 3-2-1 countdown
 *   (score card first beat, countdown alone after) + resume; goal reached
 *   while paused -> banner only (~1.5s); user playback input cancels
 * - the test-only frame injection hook (TEST_LOAD_FRAMES_EVENT)
 * - the exit chip routing
 *
 * Playback interactions (Space/arrows, scrubbing) stay covered by the e2e
 * suite; the keyboard helper itself (shouldTogglePlayback) has its own
 * unit tests.
 *
 * @see Story 7.7: Match View — Broadcast Replay
 * @priority P1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { forwardRef, useImperativeHandle } from 'react';
import { MatchPage } from '@/pages/MatchPage';
import { TEST_LOAD_FRAMES_EVENT } from '@/lib/testHooks';
import { useMatchStore } from '@/stores/matchStore';
import { useCanvasStore } from '@/stores/canvasStore';
import type { MatchFrame, MatchResult } from '@/types';

// The canvas is jsdom-hostile (Pixi/WebGL): a stub exposing the goal
// callback + a recording imperative handle lets the tests drive the
// celebration pipeline end to end.
type GoalCallback = (team: 'home' | 'away', scorerSlot: number, live: boolean) => void;
const canvasStubs: {
  onGoalScored?: GoalCallback;
  handleCalls: string[];
} = { handleCalls: [] };
vi.mock('@/components/canvas', () => ({
  TacticsCanvas: forwardRef((props: Record<string, unknown>, ref) => {
    canvasStubs.onGoalScored = props.onGoalScored as GoalCallback;
    useImperativeHandle(ref, () => ({
      loadFrames: () => canvasStubs.handleCalls.push('loadFrames'),
      seekFrame: () => canvasStubs.handleCalls.push('seekFrame'),
      play: () => canvasStubs.handleCalls.push('play'),
      pause: () => canvasStubs.handleCalls.push('pause'),
      setKickoffPause: (active: boolean) =>
        canvasStubs.handleCalls.push(active ? 'kickoffOn' : 'kickoffOff'),
      step: () => canvasStubs.handleCalls.push('step'),
      setSpeed: () => canvasStubs.handleCalls.push('setSpeed'),
      setSelectedPlayer: () => canvasStubs.handleCalls.push('setSelectedPlayer'),
      setTeamColors: () => canvasStubs.handleCalls.push('setTeamColors'),
    }));
    return <div data-testid="field-canvas-stub" />;
  }),
  TacticsCanvasHandle: {},
}));

const makeMatch = (overrides: Partial<MatchResult> = {}): MatchResult =>
  ({
    id: 'm-1',
    mode: 'practice',
    status: 'completed',
    scoreChallenger: 1,
    scoreOpponent: 0,
    result: 'challenger_win',
    challengerName: 'Pelo XI',
    opponentName: 'Gégé FC',
    durationFrames: 10800,
    createdAt: '2026-09-22T00:00:00.000Z',
    ...overrides,
  }) as unknown as MatchResult;

/** 4 frames; a challenger goal by #8 on the first frame (score 1-0 at tick 0) */
const makeFrames = (): MatchFrame[] =>
  Array.from({ length: 4 }, (_, tick): MatchFrame => {
    const frame: MatchFrame = {
      index: tick,
      ball: { x: 50, y: 50 },
      players: [{ slot: 8, team: 'challenger', x: 40, y: 40, state: 'idle' }],
      events: [],
      logs: [],
    };
    if (tick === 0) frame.events = [{ type: 'goal', team: 'challenger', scorerSlot: 8 }];
    return frame;
  });

const renderPage = (initialIndex = 1) =>
  render(
    <MemoryRouter initialEntries={['/play', '/match/m-1']} initialIndex={initialIndex}>
      <Routes>
        <Route path="/play" element={<div data-testid="play-stub" />} />
        <Route path="/match/:id" element={<MatchPage />} />
      </Routes>
    </MemoryRouter>
  );

const seedReadyReplay = () => {
  useMatchStore.setState({
    replayFrames: makeFrames(),
    replayMatch: makeMatch(),
    replayLogs: [],
    replayStats: null,
    isReplayLoading: false,
    replayError: null,
  });
  useCanvasStore.setState({ currentFrame: 3, totalFrames: 4, isPlaying: false });
};

describe('MatchPage (broadcast replay, story 7.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMatchStore.getState().clearReplay();
    useMatchStore.setState({ isReplayLoading: false, replayError: null });
    useCanvasStore.setState({
      currentFrame: 0,
      totalFrames: 0,
      isPlaying: false,
      matchFrames: [],
      logFilterPlayerId: null,
      selectedPlayerId: null,
    });
    canvasStubs.onGoalScored = undefined;
    canvasStubs.handleCalls = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the loading overlay while the frames file fetches', () => {
    useMatchStore.setState({ isReplayLoading: true, replayError: null });
    renderPage();

    expect(screen.getByTestId('replay-loading-overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('replay-drawer')).not.toBeInTheDocument();
  });

  it('shows the friendly error state with retry when the load fails', () => {
    // replayMatch carries the route's id: the load effect skips (same
    // replay already owned) and the seeded error owns the pitch
    useMatchStore.setState({
      isReplayLoading: false,
      replayError: 'Ce replay est introuvable.',
      replayMatch: makeMatch(),
    });
    renderPage();

    expect(screen.getByTestId('replay-error-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('replay-retry-button')).toBeInTheDocument();
    expect(screen.getByTestId('replay-error-back-button')).toBeInTheDocument();
  });

  it('renders the broadcast score pill with names, score, minute and frame counter', () => {
    seedReadyReplay();
    renderPage();

    const pill = screen.getByTestId('score-display');
    expect(pill).toHaveTextContent('Pelo XI');
    expect(pill).toHaveTextContent('Gégé FC');
    expect(pill).toHaveTextContent('1 — 0');
    // minute chip + frame counter (mono)
    expect(pill).toHaveTextContent('00:00');
    expect(screen.getByTestId('pill-frame-counter')).toHaveTextContent('F3/4');
  });

  it('mounts the drawer and timeline only once the replay is ready', () => {
    seedReadyReplay();
    renderPage();

    expect(screen.getByTestId('replay-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-track')).toBeInTheDocument();
    expect(screen.getByTestId('speed-button')).toHaveTextContent('1×');
  });

  it('raises the banner on a goal reached while paused and drops it after ~1.5s', () => {
    vi.useFakeTimers();
    seedReadyReplay();
    renderPage();

    expect(screen.queryByTestId('goal-celebration-overlay')).not.toBeInTheDocument();

    act(() => {
      canvasStubs.onGoalScored?.('home', 8, false);
    });
    const overlay = screen.getByTestId('goal-celebration-overlay');
    expect(overlay).toHaveTextContent('BUUUT');
    expect(overlay).toHaveTextContent('#8 · Pelo XI');
    expect(overlay).toHaveTextContent('1 — 0');
    // Seek/step path: no countdown, playback untouched
    expect(overlay).not.toHaveTextContent('3');
    expect(canvasStubs.handleCalls).not.toContain('pause');

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.queryByTestId('goal-celebration-overlay')).not.toBeInTheDocument();
  });

  it('freezes playback on a live goal, counts down 3-2-1, then resumes', () => {
    vi.useFakeTimers();
    seedReadyReplay();
    useCanvasStore.setState({ isPlaying: true });
    renderPage();

    act(() => {
      canvasStubs.onGoalScored?.('home', 8, true);
    });
    // The engine paused on the kickoff frame (teams in place, GK holds the ball)
    expect(canvasStubs.handleCalls).toContain('pause');
    expect(canvasStubs.handleCalls).toContain('kickoffOn');
    const overlay = screen.getByTestId('goal-celebration-overlay');
    expect(overlay).toHaveTextContent('1 — 0');
    expect(screen.getByTestId('goal-countdown')).toHaveTextContent('3');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Score card still holds the first beat; countdown moves on
    expect(screen.getByTestId('goal-celebration-overlay')).toHaveTextContent('BUUUT');
    expect(screen.getByTestId('goal-countdown')).toHaveTextContent('2');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Score animation passed: only the countdown remains
    expect(screen.queryByTestId('goal-celebration-overlay')).not.toHaveTextContent('BUUUT');
    expect(screen.queryByTestId('goal-celebration-overlay')).not.toHaveTextContent('1 — 0');
    expect(screen.getByTestId('goal-countdown')).toHaveTextContent('1');

    // 3s total: the overlay drops, the kickoff highlight clears, playback resumes
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId('goal-celebration-overlay')).not.toBeInTheDocument();
    expect(canvasStubs.handleCalls).toContain('kickoffOff');
    expect(canvasStubs.handleCalls).toContain('play');
  });

  it('cancels the countdown when the user takes over playback', () => {
    vi.useFakeTimers();
    seedReadyReplay();
    useCanvasStore.setState({ isPlaying: true });
    renderPage();

    act(() => {
      canvasStubs.onGoalScored?.('home', 8, true);
    });
    expect(screen.getByTestId('goal-celebration-overlay')).toBeInTheDocument();

    // The timeline control (playing state) pauses mid-countdown
    fireEvent.click(screen.getByTestId('play-pause-button'));
    expect(screen.queryByTestId('goal-celebration-overlay')).not.toBeInTheDocument();

    // The dropped countdown never auto-resumes playback
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(canvasStubs.handleCalls).not.toContain('play');
  });

  it('seeds the replay from the test-only frame injection hook', async () => {
    renderPage();

    expect(screen.queryByTestId('score-display')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(TEST_LOAD_FRAMES_EVENT, { detail: { frames: makeFrames() } })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('score-display')).toBeInTheDocument();
    });
    // The injected goal event lights the score up (frame 0 render)
    expect(screen.getByTestId('score-display')).toHaveTextContent('1 — 0');
  });

  it('exits through history when there is one', () => {
    seedReadyReplay();
    renderPage();

    fireEvent.click(screen.getByTestId('match-exit-button'));
    expect(screen.getByTestId('play-stub')).toBeInTheDocument();
  });
});
