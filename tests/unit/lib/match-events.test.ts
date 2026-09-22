/**
 * MatchEvents lib unit tests (story 7.9)
 *
 * Typed frame-event extraction for the drawer: array-position tick
 * semantics (same as computeScore), malformed-event tolerance.
 *
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import { extractFrameEvents } from '@/lib/matchEvents';
import type { MatchFrame, MatchFrameEvent } from '@/types';

function makeFrame(index: number, events: MatchFrameEvent[]): MatchFrame {
  return {
    index,
    ball: { x: 50, y: 50 },
    players: [{ slot: 1, team: 'challenger', x: 50, y: 50, state: 'idle' }],
    events,
    logs: [],
  };
}

describe('extractFrameEvents', () => {
  it('extracts only the requested event type with array-position ticks', () => {
    const frames = [
      makeFrame(0, []),
      makeFrame(1, [{ type: 'shot', team: 'challenger', shooterSlot: 8, onTarget: true }]),
      makeFrame(2, [{ type: 'turnover', team: 'opponent', takerSlot: 10, fromTeam: 'challenger' }]),
      makeFrame(3, [
        { type: 'shot', team: 'opponent', shooterSlot: 10, onTarget: false },
        { type: 'goal', team: 'opponent', scorerSlot: 10 },
      ]),
    ];

    const shots = extractFrameEvents(frames, 'shot');
    expect(shots).toEqual([
      { tick: 1, event: { type: 'shot', team: 'challenger', shooterSlot: 8, onTarget: true } },
      { tick: 3, event: { type: 'shot', team: 'opponent', shooterSlot: 10, onTarget: false } },
    ]);

    const turnovers = extractFrameEvents(frames, 'turnover');
    expect(turnovers).toEqual([
      { tick: 2, event: { type: 'turnover', team: 'opponent', takerSlot: 10, fromTeam: 'challenger' } },
    ]);
  });

  it('keys on array position, not the frame.index data field', () => {
    const frames = [makeFrame(99, [{ type: 'shot', team: 'challenger', shooterSlot: 8, onTarget: true }])];
    expect(extractFrameEvents(frames, 'shot')[0]?.tick).toBe(0);
  });

  it('skips malformed events instead of crashing (drawer tolerance)', () => {
    const frames = [
      makeFrame(0, [null as unknown as MatchFrameEvent]),
      makeFrame(1, [{ type: 'shot', team: 'challenger', shooterSlot: 8, onTarget: true }]),
    ];
    expect(extractFrameEvents(frames, 'shot')).toHaveLength(1);
  });

  it('returns an empty list for empty frames', () => {
    expect(extractFrameEvents([], 'shot')).toEqual([]);
  });
});
