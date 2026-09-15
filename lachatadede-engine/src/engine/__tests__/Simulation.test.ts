import { describe, expect, it } from 'vitest';
import { IsolatedScriptRunner } from '../IsolatedScriptRunner.js';
import { Simulation } from '../Simulation.js';
import { TOTAL_TICKS } from '../constants.js';
import { type PlayerScript, type ScriptRunner, type ScriptTickContext, type TickOutcome } from '../ScriptRunner.js';
import { SeededRandom } from '../seededRandom.js';
import type { SimulatePayload, Team } from '../types.js';

function makePayload(seed = 12345): SimulatePayload {
  return {
    match_id: 'test-match',
    seed,
    output_path: '/tmp/unused',
    challenger: {
      players: [
        { slot: 1, x: 5, y: 25, script: '' },
        { slot: 2, x: 20, y: 10, script: '' },
        { slot: 3, x: 20, y: 25, script: '' },
        { slot: 4, x: 20, y: 40, script: '' },
        { slot: 5, x: 30, y: 25, script: '' },
      ],
    },
    opponent: {
      players: [
        { slot: 1, x: 95, y: 25, script: '' },
        { slot: 2, x: 80, y: 10, script: '' },
        { slot: 3, x: 80, y: 25, script: '' },
        { slot: 4, x: 80, y: 40, script: '' },
        { slot: 5, x: 70, y: 25, script: '' },
      ],
    },
  };
}

/**
 * Payload with every outfield player clear of the y=25 flight corridor,
 * so crafted shots are not intercepted by the possession check.
 */
function makeGoalTestPayload(seed = 12345): SimulatePayload {
  return {
    match_id: 'goal-test',
    seed,
    output_path: '/tmp/unused',
    challenger: {
      players: [
        { slot: 1, x: 5, y: 5, script: '' },
        { slot: 2, x: 10, y: 5, script: '' },
        { slot: 3, x: 15, y: 5, script: '' },
        { slot: 4, x: 20, y: 5, script: '' },
        { slot: 5, x: 30, y: 25, script: '' },
      ],
    },
    opponent: {
      players: [
        { slot: 1, x: 95, y: 45, script: '' },
        { slot: 2, x: 90, y: 45, script: '' },
        { slot: 3, x: 85, y: 45, script: '' },
        { slot: 4, x: 80, y: 45, script: '' },
        { slot: 5, x: 75, y: 45, script: '' },
      ],
    },
  };
}

function kickoffTeamFor(seed: number): Team {
  return new SeededRandom(seed).next() < 0.5 ? 'challenger' : 'opponent';
}

/**
 * Test double: every player chases the ball, the owner dribbles toward the
 * opponent goal mouth. Deterministic per tick, so the engine's seeded decisions
 * (execution order, contested possession, kickoff) fully drive the trajectory.
 */
class ChasingRunner implements ScriptRunner {
  prepare(): void {}
  runTick(_tick: number, context: ScriptTickContext): TickOutcome {
    const actions = context.players.map((p) => {
      const isOwner = context.ball.owner?.slot === p.slot && context.ball.owner.team === p.team;
      const targetX = p.team === 'challenger' ? 120 : -20;
      return {
        team: p.team,
        slot: p.slot,
        action: isOwner
          ? ({ type: 'dribble', x: targetX, y: 25 } as const)
          : ({ type: 'moveToward', x: context.ball.x, y: context.ball.y } as const),
      };
    });
    return { actions, logs: [] };
  }
}

class ScriptedOnceRunner implements ScriptRunner {
  prepare(): void {}
  runTick(tick: number): TickOutcome {
    if (tick !== 3) return { actions: [], logs: [] };
    return {
      actions: [
        { team: 'challenger', slot: 1, action: { type: 'moveToward', x: 10, y: 10 } },
        { team: 'challenger', slot: 2, action: { type: 'stop' } },
      ],
      logs: [],
    };
  }
}

class PrepareCaptureRunner implements ScriptRunner {
  received: PlayerScript[] | null = null;
  prepare(scripts: PlayerScript[]): void {
    this.received = scripts;
  }
  runTick(): TickOutcome {
    return { actions: [], logs: [] };
  }
}

class ContextCaptureRunner implements ScriptRunner {
  firstContext: ScriptTickContext | null = null;
  prepare(): void {}
  runTick(tick: number, context: ScriptTickContext): TickOutcome {
    if (this.firstContext === null) this.firstContext = structuredClone(context);
    return { actions: [], logs: [] };
  }
}

describe('Simulation - frames (NoopScriptRunner)', () => {
  it('records frame 0 with the ball at the kickoff goalkeeper and all players at initial positions', async () => {
    const seed = 12345;
    const file = await new Simulation(makePayload(seed)).run();
    const f0 = file.frames[0] as NonNullable<(typeof file.frames)[number]>;
    expect(f0.index).toBe(0);
    const gk = kickoffTeamFor(seed) === 'challenger' ? { x: 5, y: 25 } : { x: 95, y: 25 };
    expect(f0.ball).toEqual(gk);
    expect(f0.players).toHaveLength(10);
    expect(f0.players[0]).toEqual({ slot: 1, team: 'challenger', x: 5, y: 25, state: 'idle' });
    expect(f0.players[5]).toEqual({ slot: 1, team: 'opponent', x: 95, y: 25, state: 'idle' });
    expect(f0.events).toEqual([]);
    expect(f0.logs).toEqual([]);
  });

  it('full match = exactly 10800 frames with sequential indexes and a draw result', async () => {
    const file = await new Simulation(makePayload()).run();
    expect(file.match_id).toBe('test-match');
    expect(file.seed).toBe(12345);
    expect(file.total_frames).toBe(TOTAL_TICKS);
    expect(file.frames).toHaveLength(TOTAL_TICKS);
    expect(file.frames[0]?.index).toBe(0);
    expect(file.frames[TOTAL_TICKS - 1]?.index).toBe(TOTAL_TICKS - 1);
    expect(file.result).toEqual({ score_challenger: 0, score_opponent: 0, winner: 'draw' });
  });
});

describe('Simulation - kickoff', () => {
  it('initial kickoff team is decided by the seed (both outcomes covered)', () => {
    const outcomes = new Set<Team>();
    for (let seed = 1; seed <= 20; seed++) {
      const sim = new Simulation(makePayload(seed));
      const expected = kickoffTeamFor(seed);
      expect(sim.ball.owner?.team).toBe(expected);
      if (sim.ball.owner) outcomes.add(sim.ball.owner.team);
    }
    expect(outcomes).toEqual(new Set<Team>(['challenger', 'opponent']));
  });

  it('initial kickoff grants the ball to the designated team goalkeeper at their tactic position', () => {
    const sim = new Simulation(makePayload(999));
    const kickoff = kickoffTeamFor(999);
    expect(sim.ball.owner).toEqual({ slot: 1, team: kickoff });
    const gk = kickoff === 'challenger' ? { x: 5, y: 25 } : { x: 95, y: 25 };
    expect(sim.ball.x).toBe(gk.x);
    expect(sim.ball.y).toBe(gk.y);
  });
});

describe('Simulation - goals and kickoff reset', () => {
  it('ball crossing x>=100 within the goal mouth scores for the challenger and resets to kickoff', () => {
    const sim = new Simulation(makeGoalTestPayload());
    sim.ball.giveTo({ slot: 3, team: 'challenger' });
    sim.ball.x = 95;
    sim.ball.y = 25;
    sim.ball.shoot(120, 25);

    const frame = sim.stepTick();

    expect(frame.events).toEqual([{ type: 'goal', team: 'challenger', scorerSlot: 3 }]);
    expect(sim.scoreChallenger).toBe(1);
    expect(sim.scoreOpponent).toBe(0);
    // kickoff reset recorded in the same frame: ball to the conceding team's GK
    expect(frame.ball).toEqual({ x: 95, y: 45 });
    expect(sim.ball.owner).toEqual({ slot: 1, team: 'opponent' }); // conceding team kicks off
    expect(frame.players[0]).toEqual({ slot: 1, team: 'challenger', x: 5, y: 5, state: 'idle' });
    expect(frame.players[5]).toEqual({ slot: 1, team: 'opponent', x: 95, y: 45, state: 'idle' });
  });

  it('ball crossing x<=0 within the goal mouth scores for the opponent', () => {
    const sim = new Simulation(makeGoalTestPayload());
    sim.ball.giveTo({ slot: 1, team: 'opponent' });
    sim.ball.x = 5;
    sim.ball.y = 20;
    sim.ball.shoot(-20, 20);

    sim.stepTick();

    expect(sim.scoreOpponent).toBe(1);
    expect(sim.scoreChallenger).toBe(0);
    expect(sim.ball.owner?.team).toBe('challenger'); // conceding team kicks off
  });

  it('scores when the trajectory crosses the goal line inside the mouth even if the tick ends outside it', () => {
    const sim = new Simulation(makeGoalTestPayload());
    sim.ball.owner = null; // craft a free ball away from all players
    sim.ball.x = 99;
    sim.ball.y = 15.9;
    sim.ball.vx = 5;
    sim.ball.vy = -2; // crosses x=100 at y=15.5 (inside); ends at (104, 13.9) (outside)
    const expectedScorer = sim.ball.lastTouch?.slot ?? -1;

    const frame = sim.stepTick();

    expect(sim.scoreChallenger).toBe(1);
    expect(sim.scoreOpponent).toBe(0);
    expect(frame.events).toEqual([{ type: 'goal', team: 'challenger', scorerSlot: expectedScorer }]);
    // no rebound happened: the ball flew past the line before the kickoff reset
    expect(sim.ball.x).toBe(95); // kickoff reset put the ball at the conceding team's goalkeeper
    expect(sim.ball.y).toBe(45);
  });

  it('does not score when the trajectory crosses the goal line outside the mouth even if the tick ends inside it', () => {
    const sim = new Simulation(makeGoalTestPayload());
    sim.ball.owner = null;
    sim.ball.x = 99;
    sim.ball.y = 14.5;
    sim.ball.vx = 5;
    sim.ball.vy = 1; // crosses x=100 at y=14.7 (outside); ends at (104, 15.5) (inside)

    const frame = sim.stepTick();

    expect(sim.scoreChallenger).toBe(0);
    expect(sim.scoreOpponent).toBe(0);
    expect(frame.events).toEqual([]);
    expect(frame.ball.x).toBe(99.9); // rebounded at the line
    expect(sim.ball.vx).toBeLessThan(0);
  });

  it('ball hitting the goal line outside the mouth rebounds without scoring', () => {
    const sim = new Simulation(makeGoalTestPayload());
    sim.ball.owner = null; // craft a free ball away from all players
    sim.ball.x = 99.5;
    sim.ball.y = 10;
    sim.ball.vx = 1;
    sim.ball.vy = 0;

    const frame = sim.stepTick();

    expect(sim.scoreChallenger).toBe(0);
    expect(sim.scoreOpponent).toBe(0);
    expect(frame.events).toEqual([]);
    expect(frame.ball.x).toBe(99.9);
    expect(sim.ball.vx).toBeLessThan(0);
  });

  it('kickoff reset grants the ball to the conceding team goalkeeper at their tactic position', () => {
    const sim = new Simulation(makeGoalTestPayload());

    // challenger scores -> conceding team (opponent) kicks off
    sim.ball.giveTo({ slot: 5, team: 'challenger' });
    sim.ball.x = 30;
    sim.ball.y = 25;
    sim.ball.shoot(200, 25);
    let frame = sim.stepTick();
    for (let i = 0; i < 100 && frame.events.length === 0; i++) {
      frame = sim.stepTick();
    }
    expect(frame.events.length).toBeGreaterThan(0);

    expect(sim.ball.owner).toEqual({ slot: 1, team: 'opponent' });
    expect(frame.ball).toEqual({ x: 95, y: 45 }); // opponent GK tactic position
    // everyone is back at their initial positions
    const slot1 = frame.players.find((p) => p.team === 'challenger' && p.slot === 1);
    expect(slot1).toEqual({ slot: 1, team: 'challenger', x: 5, y: 5, state: 'idle' });
  });
});

describe('Simulation - possession', () => {
  it('contested possession: seeded RNG decides, deterministically for a given seed', () => {
    const payload = makePayload();
    payload.challenger.players[0] = { slot: 1, x: 51, y: 25, script: '' };
    payload.opponent.players[0] = { slot: 1, x: 49, y: 25, script: '' };
    const simA = new Simulation(payload);
    const simB = new Simulation(payload);
    for (const sim of [simA, simB]) {
      sim.ball.owner = null; // craft a free ball touched by two players
      sim.ball.x = 50;
      sim.ball.y = 25;
      sim.ball.vx = 0;
      sim.ball.vy = 0;
    }
    simA.stepTick();
    simB.stepTick();
    expect(simA.ball.owner).not.toBeNull();
    expect(simB.ball.owner).toEqual(simA.ball.owner);
  });

  it('free ball is picked up by a player within COLLISION_RADIUS', () => {
    const sim = new Simulation(makePayload());
    sim.ball.owner = null;
    sim.ball.x = 6;
    sim.ball.y = 25; // challenger slot 1 is at (5,25), distance 1.0 <= 2.0
    sim.ball.vx = 0;
    sim.ball.vy = 0;

    sim.stepTick();

    expect(sim.ball.owner).toEqual({ slot: 1, team: 'challenger' });
  });

  it('the shooter is exempt from the same-tick possession check', () => {
    const sim = new Simulation(makeGoalTestPayload());
    sim.ball.giveTo({ slot: 5, team: 'challenger' });
    sim.ball.x = 30;
    sim.ball.y = 25;
    sim.ball.shoot(100, 25); // shooter stands exactly on the ball

    sim.stepTick();

    expect(sim.ball.owner).toBeNull(); // not re-granted to the shooter
    expect(sim.ball.x).toBe(35); // ball flew
  });

  it('the releaser cannot re-collect a dropped ball while within COLLISION_RADIUS', () => {
    class WalkAwayRunner implements ScriptRunner {
      prepare(): void {}
      runTick(tick: number): TickOutcome {
        if (tick < 3) {
          return {
            actions: [{ team: 'challenger', slot: 1, action: { type: 'moveToward', x: 20, y: 25 } }],
            logs: [],
          };
        }
        return { actions: [], logs: [] };
      }
    }
    const sim = new Simulation(makePayload(), new WalkAwayRunner());
    sim.ball.giveTo({ slot: 1, team: 'challenger' });
    sim.ball.x = 5;
    sim.ball.y = 25; // ball sits on the releaser
    sim.ball.release();

    // The releaser walks away one step per tick: (5,25) -> (6,25) -> (7,25) -> (8,25).
    sim.stepTick();
    sim.stepTick();
    expect(sim.ball.owner).toBeNull(); // distance 2.0: still exempt
    sim.stepTick();
    expect(sim.ball.owner).toBeNull(); // distance 3.0: exemption expired, but out of reach
  });

  it('another player can take a dropped ball while the releaser is exempt', () => {
    class DropAndStealRunner implements ScriptRunner {
      prepare(): void {}
      runTick(): TickOutcome {
        return {
          actions: [
            // the owner drops the ball and walks away from it
            { team: 'challenger', slot: 1, action: { type: 'moveToward', x: 5, y: 9 } },
            // a teammate runs onto the dropped ball
            { team: 'challenger', slot: 2, action: { type: 'moveToward', x: 5, y: 5 } },
          ],
          logs: [],
        };
      }
    }
    const sim = new Simulation(makeGoalTestPayload(), new DropAndStealRunner());
    sim.ball.giveTo({ slot: 1, team: 'challenger' });
    sim.ball.x = 5;
    sim.ball.y = 5; // challenger slot 1 stands on the ball, slot 2 starts at (10,5)

    sim.stepTick();
    expect(sim.ball.owner).toBeNull(); // dropped; slot 2 still 4.0 away
    sim.stepTick();
    sim.stepTick();

    expect(sim.ball.owner).toEqual({ slot: 2, team: 'challenger' }); // stolen at distance 2.0
    expect(sim.ball.releasedBy).toBeNull();
  });
});

describe('Simulation - tackles (game-rules.md v1.1)', () => {
  it('an opponent within COLLISION_RADIUS tackles the ball from the carrier', () => {
    const payload = makePayload();
    payload.opponent.players[4] = { slot: 5, x: 31, y: 25, script: '' }; // tackler glued to the carrier
    const sim = new Simulation(payload);
    sim.ball.giveTo({ slot: 5, team: 'challenger' });
    sim.ball.x = 30;
    sim.ball.y = 25; // ball on the carrier

    sim.stepTick();

    expect(sim.ball.owner).toEqual({ slot: 5, team: 'opponent' }); // tackled
    expect(sim.ball.x).toBe(30); // ball stays at the ex-carrier's spot
    expect(sim.ball.y).toBe(25);
  });

  it('a teammate never tackles the ball from the carrier', () => {
    const payload = makePayload();
    payload.challenger.players[1] = { slot: 2, x: 21, y: 25, script: '' }; // teammate glued to the carrier
    const sim = new Simulation(payload);
    sim.ball.giveTo({ slot: 3, team: 'challenger' });
    sim.ball.x = 20;
    sim.ball.y = 25; // ball on the carrier (challenger slot 3 at (20,25))

    sim.stepTick();

    expect(sim.ball.owner).toEqual({ slot: 3, team: 'challenger' }); // teammate did not take it
  });

  it('the tackled player cannot take any ball until the lockout expires', () => {
    class StealThenWalkAwayRunner implements ScriptRunner {
      prepare(): void {}
      runTick(tick: number): TickOutcome {
        if (tick === 0) return { actions: [], logs: [] }; // the tackle happens by proximity
        // the tackler drops the ball and walks away from it
        return { actions: [{ team: 'opponent', slot: 5, action: { type: 'moveToward', x: 60, y: 25 } }], logs: [] };
      }
    }
    const payload = makePayload();
    payload.opponent.players[4] = { slot: 5, x: 31, y: 25, script: '' };
    const sim = new Simulation(payload, new StealThenWalkAwayRunner());
    sim.ball.giveTo({ slot: 5, team: 'challenger' });
    sim.ball.x = 30;
    sim.ball.y = 25;

    sim.stepTick(); // tick 0: tackle -> opponent slot 5 owns it, challenger slot 5 locked
    expect(sim.ball.owner).toEqual({ slot: 5, team: 'opponent' });

    sim.stepTick(); // tick 1: the tackler drops the ball at (30,25) and walks off
    expect(sim.ball.owner).toBeNull(); // the tackled player stands on the ball but is locked out

    for (let t = 2; t <= 179; t++) sim.stepTick();
    expect(sim.ball.owner).toBeNull(); // still locked out at tick 179

    sim.stepTick(); // tick 180: lockout lifted (3s after the tackle)
    expect(sim.ball.owner).toEqual({ slot: 5, team: 'challenger' }); // picks the ball up automatically
  });

  it('kickoff clears all possession lockouts', () => {
    class TackleThenShootRunner implements ScriptRunner {
      prepare(): void {}
      runTick(tick: number): TickOutcome {
        if (tick === 0) {
          // the defender closes in on the carrier (from 3.0 to 2.0: tackle)
          return { actions: [{ team: 'opponent', slot: 5, action: { type: 'moveToward', x: 30, y: 25 } }], logs: [] };
        }
        if (tick === 1) {
          // the tackler clears the ball down the (empty) corridor; the
          // tackled player is locked out, so nobody re-collects it
          return { actions: [{ team: 'opponent', slot: 5, action: { type: 'shoot', x: -20, y: 25, power: 1 } }], logs: [] };
        }
        return { actions: [], logs: [] };
      }
    }
    // The tackler starts out of tackle range (3.0) and resets to (33,25)
    // after the goal, so the post-kickoff pickup below has a single candidate.
    const payload = makeGoalTestPayload();
    payload.opponent.players[4] = { slot: 5, x: 33, y: 25, script: '' };
    const sim = new Simulation(payload, new TackleThenShootRunner());
    sim.ball.giveTo({ slot: 5, team: 'challenger' });
    sim.ball.x = 30;
    sim.ball.y = 25;

    sim.stepTick(); // tick 0: tackle -> opponent slot 5 owns it, challenger slot 5 locked
    expect(sim.ball.owner).toEqual({ slot: 5, team: 'opponent' });

    let frame = sim.stepTick(); // tick 1: the tackler shoots toward the challenger goal
    for (let i = 0; i < 100 && frame.events.length === 0; i++) {
      frame = sim.stepTick();
    }
    expect(frame.events.length).toBeGreaterThan(0); // goal for the opponent
    expect(sim.ball.owner).toEqual({ slot: 1, team: 'challenger' }); // conceding team's GK kicks off

    // the kickoff cleared the lockout: the previously tackled player takes a free ball again
    sim.ball.owner = null;
    sim.ball.releasedBy = null;
    sim.ball.x = 30;
    sim.ball.y = 25; // on challenger slot 5 (back at (30,25) after the reset)
    sim.ball.vx = 0;
    sim.ball.vy = 0;
    sim.stepTick();
    expect(sim.ball.owner).toEqual({ slot: 5, team: 'challenger' });
  });

  it('a released ball travels before it can be collected (no same-tick block)', () => {
    class ShootRunner implements ScriptRunner {
      prepare(): void {}
      runTick(tick: number): TickOutcome {
        if (tick !== 0) return { actions: [], logs: [] };
        return {
          actions: [
            { team: 'challenger', slot: 5, action: { type: 'shoot', x: 200, y: 25, power: 1 } },
            { team: 'opponent', slot: 5, action: { type: 'moveToward', x: 30, y: 25 } },
          ],
          logs: [],
        };
      }
    }
    const payload = makeGoalTestPayload();
    payload.opponent.players[4] = { slot: 5, x: 33, y: 25, script: '' }; // 3.0 from the ball: out of tackle range
    const sim = new Simulation(payload, new ShootRunner());
    sim.ball.giveTo({ slot: 5, team: 'challenger' });
    sim.ball.x = 30;
    sim.ball.y = 25;

    const frame = sim.stepTick();

    // v1.2: physics runs before the possession check, so the just-struck ball
    // flies out of reach on the shoot tick; the defender closing to 2.0 of the
    // release point cannot block, only intercept at the ball's landing spot.
    expect(sim.ball.owner).toBeNull();
    expect(sim.ball.x).toBe(35); // 30 + MAX_BALL_SPEED (full power), toward (200,25)
    expect(frame.events.length).toBe(0);
  });
});

describe('Simulation - action application', () => {
  it('applies moveToward and stop actions and maps them to player states', () => {
    const sim = new Simulation(makePayload(), new ScriptedOnceRunner());
    sim.stepTick();
    sim.stepTick();
    sim.stepTick();
    const frame = sim.stepTick(); // tick 3: scripted actions fire

    const slot1 = frame.players[0] as NonNullable<(typeof frame.players)[number]>;
    expect(slot1.state).toBe('moving');
    // challenger slot 1 moves from (5,25) toward (10,10) at PLAYER_SPEED 1.0
    expect(slot1.x).toBeCloseTo(5.316227766016838, 9);
    expect(slot1.y).toBeCloseTo(24.051316701949486, 9);
    const slot2 = frame.players[1] as NonNullable<(typeof frame.players)[number]>;
    expect(slot2.state).toBe('action');
    expect(slot2.x).toBe(20); // stop does not move
    // untouched players stay idle
    const opponentSlot1 = frame.players[5] as NonNullable<(typeof frame.players)[number]>;
    expect(opponentSlot1.state).toBe('idle');
    expect(opponentSlot1.x).toBe(95);
  });

  it('moveToward with possession releases the ball in place', () => {
    const sim = new Simulation(makePayload(), new ScriptedOnceRunner());
    sim.ball.giveTo({ slot: 1, team: 'challenger' });
    sim.ball.x = 5;
    sim.ball.y = 25; // ball sits on challenger slot 1
    sim.stepTick();
    sim.stepTick();
    sim.stepTick();
    sim.stepTick(); // tick 3: moveToward(10,10) fires for challenger slot 1

    expect(sim.ball.owner).toBeNull(); // releaser exempt from the same-tick check
    expect(sim.ball.x).toBe(5); // dropped in place
    expect(sim.ball.y).toBe(25);
  });

  it('dribble keeps possession and moves the ball with the player', () => {
    class DribbleRunner implements ScriptRunner {
      prepare(): void {}
      runTick(): TickOutcome {
        return {
          actions: [{ team: 'challenger', slot: 3, action: { type: 'dribble', x: 30, y: 25 } }],
          logs: [],
        };
      }
    }
    const sim = new Simulation(makePayload(), new DribbleRunner());
    sim.ball.giveTo({ slot: 3, team: 'challenger' });
    sim.ball.x = 20;
    sim.ball.y = 25;

    const frame = sim.stepTick();

    expect(sim.ball.owner).toEqual({ slot: 3, team: 'challenger' });
    expect(sim.ball.x).toBeCloseTo(20.8, 9); // moved 0.8 (carrier speed) toward (30,25)
    const slot3 = frame.players[2] as NonNullable<(typeof frame.players)[number]>;
    expect(slot3.state).toBe('moving');
    expect(frame.ball.x).toBe(sim.ball.x);
  });

  it('shoot releases the ball with velocity and the ball travels on the next tick', () => {
    class ShootRunner implements ScriptRunner {
      prepare(): void {}
      runTick(tick: number): TickOutcome {
        if (tick !== 0) return { actions: [], logs: [] };
        return {
          actions: [{ team: 'challenger', slot: 5, action: { type: 'shoot', x: 100, y: 25, power: 1 } }],
          logs: [],
        };
      }
    }
    const sim = new Simulation(makePayload(), new ShootRunner());
    sim.ball.giveTo({ slot: 5, team: 'challenger' });
    sim.ball.x = 30;
    sim.ball.y = 25;

    const f0 = sim.stepTick();
    expect(sim.ball.owner).toBeNull();
    expect(f0.players[4]?.state).toBe('action');
    expect(f0.ball.x).toBe(35); // 30 + power(1) * MAX_BALL_SPEED 5.0
    // friction applied in the same tick: 5.0 * 0.95
    expect(Math.hypot(sim.ball.vx, sim.ball.vy)).toBeCloseTo(4.75, 12);

    sim.stepTick();
    expect(sim.ball.x).toBeCloseTo(39.75, 9); // 35 + 4.75
  });

  it('shoot velocity scales with power (velocity = power x MAX_BALL_SPEED)', () => {
    class HalfPowerRunner implements ScriptRunner {
      prepare(): void {}
      runTick(tick: number): TickOutcome {
        if (tick !== 0) return { actions: [], logs: [] };
        return {
          actions: [{ team: 'challenger', slot: 5, action: { type: 'shoot', x: 100, y: 25, power: 0.5 } }],
          logs: [],
        };
      }
    }
    const sim = new Simulation(makePayload(), new HalfPowerRunner());
    sim.ball.giveTo({ slot: 5, team: 'challenger' });
    sim.ball.x = 30;
    sim.ball.y = 25;

    sim.stepTick();
    expect(sim.ball.owner).toBeNull();
    expect(sim.ball.x).toBeCloseTo(32.5, 9); // 30 + 0.5 * 5.0
  });
});

describe('Simulation - ScriptRunner integration', () => {
  it('prepare() receives all 10 scripts with team labels', async () => {
    const runner = new PrepareCaptureRunner();
    await new Simulation(makePayload(), runner).run();
    expect(runner.received).toHaveLength(10);
    expect(runner.received?.[0]).toEqual({ slot: 1, team: 'challenger', code: '' });
    expect(runner.received?.[5]).toEqual({ slot: 1, team: 'opponent', code: '' });
  });

  it('runTick() receives a snapshot context per tick', () => {
    const runner = new ContextCaptureRunner();
    const seed = 12345;
    const sim = new Simulation(makePayload(seed), runner);
    const ownerBefore = sim.ball.owner;
    const gk = kickoffTeamFor(seed) === 'challenger' ? { x: 5, y: 25 } : { x: 95, y: 25 };
    sim.stepTick();
    expect(runner.firstContext?.tick).toBe(0);
    expect(runner.firstContext?.ball).toEqual({ x: gk.x, y: gk.y, vx: 0, vy: 0, owner: ownerBefore });
    expect(runner.firstContext?.players).toHaveLength(10);
  });
});

describe('Simulation - determinism and performance', () => {
  it('same seed produces byte-identical output (Noop runner)', async () => {
    const a = JSON.stringify(await new Simulation(makePayload()).run());
    const b = JSON.stringify(await new Simulation(makePayload()).run());
    expect(a).toBe(b);
  });

  it('same seed produces byte-identical output (deterministic actions)', async () => {
    const a = JSON.stringify(await new Simulation(makePayload(), new ChasingRunner()).run());
    const b = JSON.stringify(await new Simulation(makePayload(), new ChasingRunner()).run());
    expect(a).toBe(b);
  });

  it('different seeds produce different trajectories', async () => {
    let seedA = 0;
    let seedB = 0;
    for (let s = 1; s < 100 && seedA === 0; s++) {
      if (kickoffTeamFor(s) === 'challenger') seedA = s;
    }
    for (let s = seedA + 1; s < 200 && seedB === 0; s++) {
      if (kickoffTeamFor(s) === 'opponent') seedB = s;
    }
    expect(kickoffTeamFor(seedA)).not.toBe(kickoffTeamFor(seedB));
    const a = JSON.stringify(await new Simulation(makePayload(seedA), new ChasingRunner()).run());
    const b = JSON.stringify(await new Simulation(makePayload(seedB), new ChasingRunner()).run());
    expect(a).not.toBe(b);
  });

  it('full 10800-tick match with Noop scripts completes in under 2s (NFR2)', async () => {
    const start = performance.now();
    await new Simulation(makePayload()).run();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});

describe('Simulation - sandboxed scripts (IsolatedScriptRunner)', () => {
  const ATTACKER_SCRIPT = `
function update(game) {
  const { me, ball } = game;
  const goalX = me.team === 'home' ? 100 : 0;
  if (me.hasBall) {
    me.dribble(goalX, 25);
  } else {
    me.moveToward(ball.position.x, ball.position.y);
  }
}`;

  function scriptedPayload(seed = 12345, script = ATTACKER_SCRIPT): SimulatePayload {
    const payload = makePayload(seed);
    for (const team of [payload.challenger, payload.opponent]) {
      for (const p of team.players) {
        p.script = script;
      }
    }
    return payload;
  }

  // Full-match sandboxed runs use a generous tick deadline: under parallel
  // test-suite CPU load, a 10ms deadline can spuriously fire even for trivial
  // scripts and break byte-equality (the 10ms contract itself is covered by
  // the fast IsolatedScriptRunner unit tests).
  const integrationRunnerOptions = { tickTimeoutMs: 1000 };

  it('same seed + same scripts produce byte-identical output (extends 3.3 determinism)', async () => {
    const a = JSON.stringify(
      await new Simulation(scriptedPayload(), new IsolatedScriptRunner(integrationRunnerOptions)).run(),
    );
    const b = JSON.stringify(
      await new Simulation(scriptedPayload(), new IsolatedScriptRunner(integrationRunnerOptions)).run(),
    );
    expect(a).toBe(b);
  }, 30_000);

  it('records console.log entries in frame logs with the right slot and team', async () => {
    const payload = scriptedPayload();
    payload.challenger.players[0]!.script = `function update(game) { console.log('tick', game.me.slot); }`;
    const file = await new Simulation(payload, new IsolatedScriptRunner(integrationRunnerOptions)).run();
    const expected = { team: 'challenger', slot: 1, level: 'log', type: 'CONSOLE', message: 'tick 1' };
    // The script logs on every tick it executes.
    const frame0 = file.frames[0] as NonNullable<(typeof file.frames)[number]>;
    expect(frame0.logs).toEqual([expected]);
    const frame1 = file.frames[1] as NonNullable<(typeof file.frames)[number]>;
    expect(frame1.logs).toEqual([expected]);

    // Scripts without console output carry empty frame logs.
    const silent = await new Simulation(scriptedPayload(), new IsolatedScriptRunner(integrationRunnerOptions)).run();
    const silentFrame0 = silent.frames[0] as NonNullable<(typeof silent.frames)[number]>;
    expect(silentFrame0.logs).toEqual([]);
  }, 30_000);

  it('full 10-player sandboxed match completes well under the 30s hard cap (NFR2)', async () => {
    const start = performance.now();
    await new Simulation(scriptedPayload(), new IsolatedScriptRunner()).run();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);
});
