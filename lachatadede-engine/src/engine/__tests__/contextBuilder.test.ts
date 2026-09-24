import { describe, expect, it } from 'vitest';
import { buildTeamTickData, FIELD_DATA } from '../contextBuilder.js';
import type { ScriptTickContext } from '../ScriptRunner.js';

function makePlayers(): ScriptTickContext['players'] {
  return [
    { slot: 1, team: 'challenger', x: 5, y: 25 },
    { slot: 2, team: 'challenger', x: 20, y: 10 },
    { slot: 3, team: 'challenger', x: 20, y: 25 },
    { slot: 4, team: 'challenger', x: 20, y: 40 },
    { slot: 5, team: 'challenger', x: 30, y: 25 },
    { slot: 1, team: 'opponent', x: 95, y: 25 },
    { slot: 2, team: 'opponent', x: 80, y: 10 },
    { slot: 3, team: 'opponent', x: 80, y: 25 },
    { slot: 4, team: 'opponent', x: 80, y: 40 },
    { slot: 5, team: 'opponent', x: 70, y: 25 },
  ];
}

function makeContext(overrides: Partial<ScriptTickContext> = {}): ScriptTickContext {
  return {
    tick: 0,
    ball: { x: 50, y: 25, vx: 0, vy: 0, owner: null },
    players: makePlayers(),
    ...overrides,
  };
}

describe('contextBuilder - buildTeamTickData (v3.0 ego-centric membrane)', () => {
  it('projects the challenger seat in world coordinates (own goal at x=0)', () => {
    const view = buildTeamTickData(makeContext(), 'challenger', 3);
    expect(view.me).toEqual({ slot: 3, position: { x: 20, y: 25 }, isTeammate: true });
    expect(view.teammates.map((p) => p.slot)).toEqual([1, 2, 4, 5]);
    expect(view.opponents.map((p) => p.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(view.opponents.every((p) => p.isTeammate === false)).toBe(true);
    expect(view.teammates.every((p) => p.isTeammate === true)).toBe(true);
  });

  it('mirrors the away seat: positions x -> 100 - x so the own goal sits at x=0', () => {
    const view = buildTeamTickData(makeContext(), 'opponent', 3);
    expect(view.me).toEqual({ slot: 3, position: { x: 20, y: 25 }, isTeammate: true });
    // Opponent GK at world x=95 appears at x=5 in the away script's frame
    // (own goal side); the challengers (world x=5..30) appear at x=95..70.
    expect(view.teammates.map((p) => [p.slot, p.position.x, p.position.y])).toEqual([
      [1, 5, 25],
      [2, 20, 10],
      [4, 20, 40],
      [5, 30, 25],
    ]);
    expect(view.opponents.map((p) => [p.slot, p.position.x, p.position.y])).toEqual([
      [1, 95, 25],
      [2, 80, 10],
      [3, 80, 25],
      [4, 80, 40],
      [5, 70, 25],
    ]);
  });

  it('mirrors the ball position and flips vx for the away seat; y and vy are untouched', () => {
    const world = { x: 30, y: 12, vx: 0.5, vy: -0.25, owner: null as null };
    const home = buildTeamTickData(makeContext({ ball: world }), 'challenger', 1);
    expect(home.ball).toEqual({
      position: { x: 30, y: 12 },
      velocity: { vx: 0.5, vy: -0.25 },
      owner: null,
    });
    const away = buildTeamTickData(makeContext({ ball: world }), 'opponent', 1);
    expect(away.ball).toEqual({
      position: { x: 70, y: 12 },
      velocity: { vx: -0.5, vy: -0.25 },
      owner: null,
    });
  });

  it('exposes the ball owner relative to the viewer (me / teammate / opponent)', () => {
    const mine = buildTeamTickData(
      makeContext({ ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 3, team: 'challenger' } } }),
      'challenger',
      3,
    );
    expect(mine.ball.owner).toEqual({ side: 'me', slot: 3 });

    const mate = buildTeamTickData(
      makeContext({ ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 2, team: 'challenger' } } }),
      'challenger',
      3,
    );
    expect(mate.ball.owner).toEqual({ side: 'teammate', slot: 2 });

    const theirs = buildTeamTickData(
      makeContext({ ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 3, team: 'challenger' } } }),
      'opponent',
      3,
    );
    expect(theirs.ball.owner).toEqual({ side: 'opponent', slot: 3 });

    // Away seat: the opponent-team owner is mirrored on the wire side only;
    // the side stays relative and the slot is world-true.
    const awaySelf = buildTeamTickData(
      makeContext({ ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 3, team: 'opponent' } } }),
      'opponent',
      3,
    );
    expect(awaySelf.ball.owner).toEqual({ side: 'me', slot: 3 });
  });

  it('serves the ego field to every seat: ownGoal at x=0, opponentGoal at x=100', () => {
    expect(FIELD_DATA).toEqual({
      width: 100,
      height: 50,
      ownGoal: { x: 0, y: 25, width: 20 },
      opponentGoal: { x: 100, y: 25, width: 20 },
      ownBox: { x1: 0, y1: 15, x2: 16, y2: 35 },
      opponentBox: { x1: 84, y1: 15, x2: 100, y2: 35 },
      center: { x: 50, y: 25 },
    });
    const home = buildTeamTickData(makeContext(), 'challenger', 1);
    const away = buildTeamTickData(makeContext(), 'opponent', 1);
    expect(home.field).toBe(FIELD_DATA);
    expect(away.field).toBe(FIELD_DATA);
  });

  it('throws when the requested slot is missing from the team', () => {
    expect(() => buildTeamTickData(makeContext(), 'challenger', 9)).toThrow(
      'no player data for team challenger slot 9',
    );
  });
});
