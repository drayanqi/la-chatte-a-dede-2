/**
 * MatchFrames Unit Tests
 *
 * Tests the engine→canvas y normalization: replay frames carry y in engine
 * field units (0-50) while the canvas renders percent coordinates (0-100),
 * so normalizeMatchFrames must scale y by 2 for players AND the ball while
 * leaving x untouched.
 *
 * Regression context: without normalization the whole replay renders
 * squashed into the top half of the pitch and the goalkeeper floats out of
 * his goal (engine y=25 rendered at 25% height instead of the center).
 *
 * @priority P0
 */
import { describe, it, expect } from 'vitest';
import { normalizeMatchFrames } from '@/lib/matchFrames';
import type { MatchFrame } from '@/types';

function frameWith(overrides: Partial<MatchFrame> = {}): MatchFrame {
  return {
    index: 0,
    ball: { x: 50, y: 25 },
    players: [
      { slot: 1, team: 'challenger', x: 8, y: 25, state: 'idle' },
      { slot: 1, team: 'opponent', x: 92, y: 25, state: 'moving' },
    ],
    events: [],
    logs: [],
    ...overrides,
  };
}

describe('normalizeMatchFrames', () => {
  it('scales player and ball y from engine units (0-50) to percent (0-100)', () => {
    const [out] = normalizeMatchFrames([frameWith()]);

    expect(out.ball.y).toBe(50);
    expect(out.players[0].y).toBe(50);
    expect(out.players[1].y).toBe(50);
  });

  it('maps the full engine y range onto the pitch: 0 stays 0, 50 becomes 100', () => {
    const [out] = normalizeMatchFrames([
      frameWith({
        ball: { x: 50, y: 50 },
        players: [{ slot: 2, team: 'challenger', x: 25, y: 0, state: 'idle' }],
      }),
    ]);

    expect(out.ball.y).toBe(100);
    expect(out.players[0].y).toBe(0);
  });

  it('leaves x untouched and preserves frame identity fields', () => {
    const [out] = normalizeMatchFrames([frameWith({ index: 42 })]);

    expect(out.index).toBe(42);
    expect(out.ball.x).toBe(50);
    expect(out.players[0].x).toBe(8);
    expect(out.players[0].slot).toBe(1);
    expect(out.players[0].state).toBe('idle');
  });

  it('does not mutate the input frames', () => {
    const input = frameWith();
    normalizeMatchFrames([input]);

    expect(input.ball.y).toBe(25);
    expect(input.players[0].y).toBe(25);
  });

  it('normalizes every frame in the payload', () => {
    const out = normalizeMatchFrames([
      frameWith({ index: 0, ball: { x: 50, y: 10 } }),
      frameWith({ index: 1, ball: { x: 50, y: 30 } }),
    ]);

    expect(out).toHaveLength(2);
    expect(out[0].ball.y).toBe(20);
    expect(out[1].ball.y).toBe(60);
  });
});
