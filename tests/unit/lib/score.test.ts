/**
 * Score Computation Unit Tests (story 3.7, Task 5/6)
 *
 * The on-screen score is derived by replaying the goal events of the loaded
 * frames up to the current tick — a pure function, no engine involved.
 *
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import { computeScore, extractGoalEvents, extractGoalTicks } from '@/lib/score';
import type { MatchFrame, MatchFrameEvent, MatchFramePlayer } from '@/types';

/** Frame factory: 10 players + centered ball, customizable events */
function makeFrame(index: number, events: MatchFrameEvent[] = []): MatchFrame {
  const players: MatchFramePlayer[] = [];
  for (const team of ['challenger', 'opponent'] as const) {
    for (let slot = 1; slot <= 5; slot++) {
      players.push({ team, slot, x: 50, y: 50, state: 'idle' });
    }
  }
  return { index, ball: { x: 50, y: 50 }, players, events, logs: [] };
}

function goalEvent(team: 'challenger' | 'opponent', scorerSlot = 3): MatchFrameEvent {
  return { type: 'goal', team, scorerSlot };
}

describe('computeScore', () => {
  it('should return 0 — 0 for frames without any goal event', () => {
    const frames = [makeFrame(0), makeFrame(1), makeFrame(2)];
    expect(computeScore(frames, 2)).toEqual({ challenger: 0, opponent: 0 });
  });

  it('should return 0 — 0 for an empty frame list', () => {
    expect(computeScore([], 10)).toEqual({ challenger: 0, opponent: 0 });
  });

  it('should count a challenger goal at or before the current tick', () => {
    const frames = [makeFrame(0), makeFrame(1, [goalEvent('challenger')]), makeFrame(2)];
    expect(computeScore(frames, 2)).toEqual({ challenger: 1, opponent: 0 });
  });

  it('should NOT count a goal scored after the current tick', () => {
    const frames = [makeFrame(0), makeFrame(1), makeFrame(2, [goalEvent('challenger')])];
    expect(computeScore(frames, 1)).toEqual({ challenger: 0, opponent: 0 });
    expect(computeScore(frames, 2)).toEqual({ challenger: 1, opponent: 0 });
  });

  it('should count the goal exactly at the current tick (inclusive)', () => {
    const frames = [makeFrame(0), makeFrame(1, [goalEvent('opponent')]), makeFrame(2)];
    expect(computeScore(frames, 1)).toEqual({ challenger: 0, opponent: 1 });
  });

  it('should count goals for both teams (3 — 2 shape)', () => {
    const frames = [
      makeFrame(0, [goalEvent('challenger', 1)]),
      makeFrame(1, [goalEvent('opponent', 2)]),
      makeFrame(2, [goalEvent('challenger', 1), goalEvent('challenger', 4)]),
      makeFrame(3, [goalEvent('opponent', 5)]),
      makeFrame(4, [goalEvent('challenger', 2)]),
    ];
    expect(computeScore(frames, 4)).toEqual({ challenger: 4, opponent: 2 });
  });

  it('should handle a draw (1 — 1)', () => {
    const frames = [
      makeFrame(0, [goalEvent('challenger')]),
      makeFrame(1, [goalEvent('opponent')]),
    ];
    expect(computeScore(frames, 1)).toEqual({ challenger: 1, opponent: 1 });
  });

  it('should count several goals carried by the same frame', () => {
    const frames = [
      makeFrame(0, [goalEvent('challenger', 1), goalEvent('challenger', 2)]),
      makeFrame(1),
    ];
    expect(computeScore(frames, 1)).toEqual({ challenger: 2, opponent: 0 });
  });

  it('should ignore non-goal events gracefully', () => {
    const frames = [
      makeFrame(0, [{ type: 'whistle' } as unknown as MatchFrameEvent]),
      makeFrame(1),
    ];
    // Only 'goal' events count
    expect(computeScore(frames, 1)).toEqual({ challenger: 0, opponent: 0 });
  });

  it('should count every goal beyond the last frame when the tick overshoots', () => {
    const frames = [
      makeFrame(0, [goalEvent('opponent')]),
      makeFrame(1, [goalEvent('challenger')]),
    ];
    expect(computeScore(frames, 1000)).toEqual({ challenger: 1, opponent: 1 });
  });

  it('should key on array position, not the frame.index data field', () => {
    // GIVEN: frames whose index field drifts from their array position
    // (playback ticks are array positions — the score must follow them)
    const frames = [makeFrame(0, [goalEvent('challenger')]), makeFrame(7)];

    // THEN: the goal counts at the goal frame's POSITION, whatever index says
    expect(computeScore(frames, 0)).toEqual({ challenger: 1, opponent: 0 });
    expect(computeScore(frames, 1)).toEqual({ challenger: 1, opponent: 0 });
  });
});

// Story 3.9 (Task 3): goal positions for the timeline scrubber markers
describe('extractGoalTicks', () => {
  it('should return an empty list for frames without any goal event', () => {
    const frames = [makeFrame(0), makeFrame(1), makeFrame(2)];
    expect(extractGoalTicks(frames)).toEqual([]);
  });

  it('should return an empty list for an empty frame list', () => {
    expect(extractGoalTicks([])).toEqual([]);
  });

  it('should map one entry per goal event, keyed on array position', () => {
    const frames = [
      makeFrame(0),
      makeFrame(1, [goalEvent('challenger')]),
      makeFrame(2),
      makeFrame(3, [goalEvent('opponent')]),
    ];
    expect(extractGoalTicks(frames)).toEqual([
      { tick: 1, team: 'challenger' },
      { tick: 3, team: 'opponent' },
    ]);
  });

  it('should keep every goal carried by the same frame', () => {
    const frames = [makeFrame(0, [goalEvent('challenger', 1), goalEvent('opponent', 2)])];
    expect(extractGoalTicks(frames)).toEqual([
      { tick: 0, team: 'challenger' },
      { tick: 0, team: 'opponent' },
    ]);
  });

  it('should key on array position, not the frame.index data field', () => {
    const frames = [makeFrame(0, [goalEvent('challenger')]), makeFrame(7)];
    expect(extractGoalTicks(frames)).toEqual([{ tick: 0, team: 'challenger' }]);
  });

  it('should ignore non-goal events gracefully', () => {
    const frames = [
      makeFrame(0, [{ type: 'whistle' } as unknown as MatchFrameEvent]),
      makeFrame(1, [goalEvent('opponent')]),
    ];
    expect(extractGoalTicks(frames)).toEqual([{ tick: 1, team: 'opponent' }]);
  });
});

describe('extractGoalEvents', () => {
  it('should carry the scorer slot with every goal', () => {
    const frames = [
      makeFrame(0),
      makeFrame(1, [goalEvent('challenger', 8)]),
      makeFrame(2, [goalEvent('opponent', 10)]),
    ];
    expect(extractGoalEvents(frames)).toEqual([
      { tick: 1, team: 'challenger', scorerSlot: 8 },
      { tick: 2, team: 'opponent', scorerSlot: 10 },
    ]);
  });

  it('should skip malformed events instead of crashing (drawer tolerance)', () => {
    const frames = [
      makeFrame(0, [null as unknown as MatchFrameEvent]),
      makeFrame(1, [goalEvent('challenger', 4)]),
    ];
    expect(extractGoalEvents(frames)).toEqual([
      { tick: 1, team: 'challenger', scorerSlot: 4 },
    ]);
  });

  it('should return an empty list for an empty frame list', () => {
    expect(extractGoalEvents([])).toEqual([]);
  });
});
