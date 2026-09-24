import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EASY_BOT_OPPONENT_PLAYERS,
  EASY_BOT_SCRIPTS,
  EASY_BOT_SCRIPTS_BY_SLOT,
} from '../bots/easy/index.js';
import { IsolatedScriptRunner } from '../IsolatedScriptRunner.js';
import { Simulation } from '../Simulation.js';
import type { Frame, SimulatePayload } from '../types.js';

const ROLES = ['goalkeeper', 'defender1', 'defender2', 'attacker1', 'attacker2'] as const;

// Full-match sandboxed runs use a generous tick deadline (see the 3.4 suite):
// a 10ms deadline can spuriously fire under CPU load and these tests assert
// bot behavior, not the 10ms contract. The match budget is relaxed for the
// same reason: a loaded machine can push a match past the 30s production
// watchdog, whose mid-match player disabling would break the determinism
// byte-comparison.
const integrationRunnerOptions = { tickTimeoutMs: 1000, matchBudgetMs: 120_000 };

// The StarterAI fixture doubles as the behavioral challenger: an idle
// challenger would freeze the match after the first goal (sticky possession
// keeps the parked ball forever), while the starter keeps the ball alive so
// every bot code path runs (chase, defend, dribble, shoot, clear).
const STARTER_AI = readFileSync(new URL('../bots/starter-ai.js', import.meta.url), 'utf8');

/** Bot payload: the Easy Bot defends x=100 (away side). */
function botPayload(seed: number, challengerScript = STARTER_AI): SimulatePayload {
  return {
    match_id: 'easy-bot-test',
    seed,
    output_path: '/tmp/unused',
    challenger: {
      players: [
        { slot: 1, x: 8, y: 25, script: challengerScript },
        { slot: 2, x: 25, y: 15, script: challengerScript },
        { slot: 3, x: 25, y: 35, script: challengerScript },
        { slot: 4, x: 40, y: 15, script: challengerScript },
        { slot: 5, x: 40, y: 35, script: challengerScript },
      ],
    },
    opponent: { players: EASY_BOT_OPPONENT_PLAYERS.map((p) => ({ ...p })) },
  };
}

function opponentPlayer(frame: { players: { slot: number; team: string; x: number; y: number }[] }, slot: number) {
  const player = frame.players.find((p) => p.team === 'opponent' && p.slot === slot);
  expect(player).toBeDefined();
  return player as { slot: number; team: string; x: number; y: number };
}

describe('Easy Bot fixtures (Task 1)', () => {
  it('exposes one canonical script per role, loaded from the bot .js files', () => {
    for (const role of ROLES) {
      const file = readFileSync(new URL(`../bots/easy/${role}.js`, import.meta.url), 'utf8');
      expect(EASY_BOT_SCRIPTS[role]).toBe(file);
    }
  });

  it('scripts.json (Laravel seeder source) stays in sync with the canonical .js files', () => {
    const json = JSON.parse(
      readFileSync(new URL('../bots/easy/scripts.json', import.meta.url), 'utf8'),
    ) as Record<string, string>;
    expect(json).toEqual({ ...EASY_BOT_SCRIPTS });
  });

  it('maps the five scripts to slots 1-5 in formation order', () => {
    expect(EASY_BOT_SCRIPTS_BY_SLOT).toEqual([
      EASY_BOT_SCRIPTS.goalkeeper,
      EASY_BOT_SCRIPTS.defender1,
      EASY_BOT_SCRIPTS.defender2,
      EASY_BOT_SCRIPTS.attacker1,
      EASY_BOT_SCRIPTS.attacker2,
    ]);
  });

  it('uses the away-side kickoff geometry mirrored from the 3.2 home formation', () => {
    expect(EASY_BOT_OPPONENT_PLAYERS.map((p) => [p.slot, p.x, p.y])).toEqual([
      [1, 92, 25],
      [2, 75, 15],
      [3, 75, 35],
      [4, 60, 15],
      [5, 60, 35],
    ]);
  });

  it('contains no randomness or clock reads (AC #3 determinism)', () => {
    for (const role of ROLES) {
      const code = EASY_BOT_SCRIPTS[role];
      expect(code).not.toMatch(/Math\.random/);
      expect(code).not.toMatch(/Date\.now/);
    }
  });
});

describe('Easy Bot behavior (AC #1)', () => {
  it('goalkeeper stays within 12 units of its goal line for the majority of ticks', async () => {
    const file = await new Simulation(botPayload(42), new IsolatedScriptRunner(integrationRunnerOptions)).run();
    expect(file.frames.length).toBe(10800);

    const nearGoalLine = file.frames.filter((frame) => 100 - opponentPlayer(frame, 1).x <= 12).length;
    expect(nearGoalLine / file.frames.length).toBeGreaterThan(0.5);
  }, 30_000);

  it('goalkeeper keeps tracking inside the goal mouth (y clamped to [15, 35])', async () => {
    const file = await new Simulation(botPayload(42), new IsolatedScriptRunner(integrationRunnerOptions)).run();

    for (const frame of file.frames) {
      const gk = opponentPlayer(frame, 1);
      expect(gk.y).toBeGreaterThanOrEqual(15);
      expect(gk.y).toBeLessThanOrEqual(35);
    }
  }, 30_000);

  it('goalkeeper positions on the ball owner -> goal centre axis (owned ball)', () => {
    // Owner parked at (60, 10): the owner->goal(100, 25) segment crosses the
    // keeper line x=95 at y = 10 + ((95-60)/40) * (25-10) = 23.125. The rest
    // of the bot team is frozen so the scenario isolates the GK projection.
    const payload = botPayload(99, '');
    payload.challenger.players[4]!.x = 60;
    payload.challenger.players[4]!.y = 10;
    for (const player of payload.opponent.players) {
      if (player.slot !== 1) player.script = '';
    }

    const runner = new IsolatedScriptRunner(integrationRunnerOptions);
    runner.prepare([
      ...payload.challenger.players.map((p) => ({ slot: p.slot, team: 'challenger' as const, code: p.script })),
      ...payload.opponent.players.map((p) => ({ slot: p.slot, team: 'opponent' as const, code: p.script })),
    ]);
    const sim = new Simulation(payload, runner);
    sim.ball.giveTo({ slot: 5, team: 'challenger' });
    sim.ball.x = 60;
    sim.ball.y = 10;

    let frame = sim.stepTick();
    for (let i = 1; i < 40; i++) frame = sim.stepTick();

    const gk = opponentPlayer(frame, 1);
    expect(Math.abs(gk.x - 95)).toBeLessThan(0.5);
    expect(Math.abs(gk.y - 23.125)).toBeLessThan(0.5);
  });

  it('goalkeeper tracks the axis from a loose ball to the goal centre (free ball)', () => {
    // Free ball parked at (45, 40) — outside the away own half so no frozen
    // teammate matters: the ball->goal(100, 25) segment crosses the keeper
    // line x=95 at y = 40 + ((95-45)/55) * (25-40) = 26.364.
    const payload = botPayload(99, '');
    for (const player of payload.opponent.players) {
      if (player.slot !== 1) player.script = '';
    }

    const runner = new IsolatedScriptRunner(integrationRunnerOptions);
    runner.prepare([
      ...payload.challenger.players.map((p) => ({ slot: p.slot, team: 'challenger' as const, code: p.script })),
      ...payload.opponent.players.map((p) => ({ slot: p.slot, team: 'opponent' as const, code: p.script })),
    ]);
    const sim = new Simulation(payload, runner);
    // Release the constructor's kickoff possession: the scenario needs a
    // loose ball for the free-ball branch of the projection.
    sim.ball.release();
    sim.ball.x = 45;
    sim.ball.y = 40;

    let frame = sim.stepTick();
    for (let i = 1; i < 40; i++) frame = sim.stepTick();

    const gk = opponentPlayer(frame, 1);
    expect(Math.abs(gk.x - 95)).toBeLessThan(0.5);
    expect(Math.abs(gk.y - 26.364)).toBeLessThan(0.5);
  });

  it('defenders hold a position between the ball and their goal when the ball sits in their half', () => {
    // Idle challenger: only the parked ball matters for this scenario.
    const payload = botPayload(7, '');
    // Idle challenger slot 5 owns a ball parked deep in the away half. Under
    // tackle rules the closest bot (the slot-4 attacker, 5 units away) will
    // steal it and dribble away, so the assertion is not "the ball never
    // moves" but the defensive shape: at every tick both defenders stay
    // goal-side of the ball (monotonic x-ordering ball < defender < x=100),
    // whether the ball is parked, dribbled, or reset by a kickoff.
    payload.challenger.players[4]!.x = 60;
    payload.challenger.players[4]!.y = 20;

    const runner = new IsolatedScriptRunner(integrationRunnerOptions);
    runner.prepare([
      ...payload.challenger.players.map((p) => ({ slot: p.slot, team: 'challenger' as const, code: p.script })),
      ...payload.opponent.players.map((p) => ({ slot: p.slot, team: 'opponent' as const, code: p.script })),
    ]);
    const sim = new Simulation(payload, runner);
    sim.ball.giveTo({ slot: 5, team: 'challenger' });
    sim.ball.x = 60;
    sim.ball.y = 20;

    let frame = sim.stepTick();
    for (let i = 1; i < 400; i++) frame = sim.stepTick();

    for (const slot of [2, 3]) {
      const defender = opponentPlayer(frame, slot);
      // Monotonic x-ordering: ball < defender < own goal line (x=100).
      expect(defender.x).toBeGreaterThan(sim.ball.x);
      expect(defender.x).toBeLessThan(100);
    }
  });

  it('attacker with the ball in shooting range produces shoot actions (state action + ball spike)', () => {
    // Crafted scenario: in a full StarterAI match the chasing pack glues to the
    // carrier and most shots are re-collected (documented in Task 6), so this
    // isolates the shooting clause. The away slot-4 attacker starts in
    // possession one dribble outside the 11-unit shooting range, with every
    // other player far from the shot lane.
    const payload = botPayload(99, '');
    const attacker = payload.opponent.players[3]!; // slot 4
    attacker.x = 12; // 12 units from x=0: two 0.8 dribbles to 10.4, then shoots
    attacker.y = 25;

    const runner = new IsolatedScriptRunner(integrationRunnerOptions);
    runner.prepare([
      ...payload.challenger.players.map((p) => ({ slot: p.slot, team: 'challenger' as const, code: p.script })),
      ...payload.opponent.players.map((p) => ({ slot: p.slot, team: 'opponent' as const, code: p.script })),
    ]);
    const sim = new Simulation(payload, runner);
    sim.ball.giveTo({ slot: 4, team: 'opponent' });
    sim.ball.x = 12;
    sim.ball.y = 25;

    const frames: Frame[] = [];
    for (let i = 0; i < 50; i++) frames.push(sim.stepTick());

    const shotFrames = frames.filter((frame, index) => {
      if (index === 0) return false;
      const previous = frames[index - 1] as Frame;
      // A 0.45-power shot moves the ball ~0.79 in its first tick (v1.7
      // speeds), clearly above the 0.5 gate — no run (0.354) or dribble
      // (0.283) can reach it.
      const spike = Math.hypot(frame.ball.x - previous.ball.x, frame.ball.y - previous.ball.y) >= 0.5;
      const attackerShot = frame.players.some(
        (p) => p.team === 'opponent' && (p.slot === 4 || p.slot === 5) && p.state === 'action',
      );
      return spike && attackerShot;
    });

    expect(shotFrames.length).toBeGreaterThanOrEqual(1);
  });

  it('produces no warn-level logs for bot players in a clean run', async () => {
    const file = await new Simulation(botPayload(123), new IsolatedScriptRunner(integrationRunnerOptions)).run();

    const botWarnings = file.frames
      .flatMap((frame) => frame.logs)
      .filter((log) => log.team === 'opponent' && log.level === 'warn');
    expect(botWarnings).toEqual([]);
  }, 30_000);
});

describe('Easy Bot predictability (AC #3)', () => {
  it('same seed + bot scripts produce byte-identical matches (no bot randomness)', async () => {
    const a = JSON.stringify(
      await new Simulation(botPayload(2024), new IsolatedScriptRunner(integrationRunnerOptions)).run(),
    );
    const b = JSON.stringify(
      await new Simulation(botPayload(2024), new IsolatedScriptRunner(integrationRunnerOptions)).run(),
    );
    expect(a).toBe(b);
  }, 30_000);
});

describe('Easy Bot perfect mirror (story 8.5, AC #4)', () => {
  /** Payload with the EASY BOT on BOTH sides (home-side geometry everywhere). */
  function mirrorPayload(seed: number): SimulatePayload {
    const homePlayers = [
      { slot: 1, x: 8, y: 25, script: EASY_BOT_SCRIPTS.goalkeeper },
      { slot: 2, x: 25, y: 15, script: EASY_BOT_SCRIPTS.defender1 },
      { slot: 3, x: 25, y: 35, script: EASY_BOT_SCRIPTS.defender2 },
      { slot: 4, x: 40, y: 15, script: EASY_BOT_SCRIPTS.attacker1 },
      { slot: 5, x: 40, y: 35, script: EASY_BOT_SCRIPTS.attacker2 },
    ];
    return {
      match_id: 'easy-bot-mirror-test',
      seed,
      output_path: '/tmp/unused',
      challenger: { players: homePlayers.map((p) => ({ ...p })) },
      opponent: { players: EASY_BOT_OPPONENT_PLAYERS.map((p) => ({ ...p })) },
    };
  }

  it('scripts contain no home/away vocabulary at all (side-free by construction)', () => {
    for (const role of ROLES) {
      expect(EASY_BOT_SCRIPTS[role]).not.toMatch(/\bme\.team\b|'home'|'away'/);
    }
  });

  it('plays the same seed in BOTH seats and every goal lands in the right net', async () => {
    const file = await new Simulation(mirrorPayload(1234), new IsolatedScriptRunner(integrationRunnerOptions)).run();
    expect(file.frames.length).toBe(10800);

    // The Easy Bot baseline is the sterile 0-0 draw pinned by
    // EasyBotBalance.test — no side even attempts a shot, so there is no
    // goal event to direction-check here; the mirrored keeper-shape test
    // below pins each seat's attacking frame geometrically.
    expect(file.result).toEqual({ score_challenger: 0, score_opponent: 0, winner: 'draw' });

    // The membrane must not surface a single script error across both seats.
    const errorLogs = file.frames.flatMap((frame) => frame.logs.filter((l) => l.type === 'SCRIPT_ERROR'));
    expect(errorLogs).toEqual([]);
  }, 60_000);

  it('mirrors the goalkeeping shape: each seat keeper holds ITS ego x=5 line', async () => {
    const file = await new Simulation(mirrorPayload(1234), new IsolatedScriptRunner(integrationRunnerOptions)).run();

    // World-space truth: the challenger GK defends x=0 (ego line 5), the
    // opponent GK defends x=100 (ego line 5 mirrored to world 95). If the
    // membrane broke, one of them would wander to the wrong half.
    for (const frame of file.frames) {
      const homeGk = frame.players.find((p) => p.team === 'challenger' && p.slot === 1);
      const awayGk = frame.players.find((p) => p.team === 'opponent' && p.slot === 1);
      expect(homeGk!.x).toBeLessThanOrEqual(12);
      expect(awayGk!.x).toBeGreaterThanOrEqual(88);
    }
  }, 60_000);
});
