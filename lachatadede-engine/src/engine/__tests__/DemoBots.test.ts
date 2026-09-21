import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEMO_FORMATIONS,
  demoChallengerPlayers,
  demoOpponentPlayers,
} from '../bots/demo/index.js';
import type { DemoFormation } from '../bots/demo/index.js';
import { IsolatedScriptRunner } from '../IsolatedScriptRunner.js';
import { Simulation } from '../Simulation.js';
import type { Frame, SimulatePayload } from '../types.js';

// Full-match sandboxed runs use a generous tick deadline (see the 3.4 suite):
// a 10ms deadline can spuriously fire under CPU load and these tests assert
// demo behavior, not the 10ms contract. The match budget is relaxed for the
// same reason (byte-comparison determinism, like the Easy Bot suite).
const integrationRunnerOptions = { tickTimeoutMs: 1000, matchBudgetMs: 120_000 };

const ONE_TWO_ONE = 'one-two-one' as const;
const TWO_TWO = 'two-two' as const;

/** Demo payload: the formation keyed first plays the challenger (home) side. */
function demoPayload(
  seed: number,
  homeKey: DemoFormation['key'],
  awayKey: DemoFormation['key'],
): SimulatePayload {
  return {
    match_id: `demo-${homeKey}-vs-${awayKey}-${seed}`,
    seed,
    output_path: '/tmp/unused',
    challenger: { players: demoChallengerPlayers(homeKey).map((p) => ({ ...p })) },
    opponent: { players: demoOpponentPlayers(awayKey).map((p) => ({ ...p })) },
  };
}

interface DemoMatch {
  sim: Simulation;
  frames: Frame[];
  /** ball owner id ("challenger-3") or null, per tick. */
  owners: (string | null)[];
}

async function runMatch(payload: SimulatePayload): Promise<DemoMatch> {
  const runner = new IsolatedScriptRunner(integrationRunnerOptions);
  await runner.prepare([
    ...payload.challenger.players.map((p) => ({ slot: p.slot, team: 'challenger' as const, code: p.script })),
    ...payload.opponent.players.map((p) => ({ slot: p.slot, team: 'opponent' as const, code: p.script })),
  ]);
  const sim = new Simulation(payload, runner);
  const frames: Frame[] = [];
  const owners: (string | null)[] = [];
  for (let i = 0; i < 10800; i++) {
    frames.push(sim.stepTick());
    const owner = sim.ball.owner;
    owners.push(owner === null ? null : `${owner.team}-${owner.slot}`);
  }
  return { sim, frames, owners };
}

function playerBySlot(
  frame: Frame,
  team: 'challenger' | 'opponent',
  slot: number,
): { slot: number; team: string; x: number; y: number; state: string } {
  const player = frame.players.find((p) => p.team === team && p.slot === slot);
  expect(player).toBeDefined();
  return player as { slot: number; team: string; x: number; y: number; state: string };
}

/** Same-team ball handoffs (completed passes or teammate recoveries). */
function countTeamHandoffs(owners: (string | null)[], team: 'challenger' | 'opponent'): number {
  let count = 0;
  let previous: string | null = null;
  for (const owner of owners) {
    if (owner !== null && previous !== null
        && owner.startsWith(`${team}-`) && previous.startsWith(`${team}-`)
        && owner !== previous) {
      count++;
    }
    previous = owner ?? previous;
  }
  return count;
}

describe('Demo fixtures (GK + 1-2-1 / GK + 2-2)', () => {
  it('exposes one canonical script per player, loaded from the formation .js files', () => {
    for (const formation of DEMO_FORMATIONS) {
      for (const player of formation.players) {
        const file = readFileSync(
          new URL(`../bots/demo/${formation.key}/${player.role}.js`, import.meta.url),
          'utf8',
        );
        expect(player.code).toBe(file);
      }
    }
  });

  it('scripts.json (demo wiring source) stays in sync with the canonical formation data', () => {
    const json = JSON.parse(
      readFileSync(new URL('../bots/demo/scripts.json', import.meta.url), 'utf8'),
    ) as Record<string, unknown>;
    expect(json).toEqual(Object.fromEntries(DEMO_FORMATIONS.map((formation) => [formation.key, {
      tactic_name: formation.tacticName,
      owner_email: formation.ownerEmail,
      players: formation.players.map((player) => ({
        role: player.role,
        script_name: player.scriptName,
        position_x: player.positionX,
        position_y: player.positionY,
        code: player.code,
      })),
    }])));
  });

  it('contains no randomness or clock reads (determinism)', () => {
    for (const formation of DEMO_FORMATIONS) {
      for (const player of formation.players) {
        expect(player.code).not.toMatch(/Math\.random/);
        expect(player.code).not.toMatch(/Date\.now/);
      }
    }
  });

  it('uses the documented home-side kickoff geometry', () => {
    const oneTwoOne = demoChallengerPlayers(ONE_TWO_ONE).map((p) => [p.slot, p.x, p.y]);
    expect(oneTwoOne).toEqual([
      [1, 8, 25],
      [2, 22, 25],
      [3, 42, 12],
      [4, 42, 38],
      [5, 62, 25],
    ]);
    const twoTwo = demoChallengerPlayers(TWO_TWO).map((p) => [p.slot, p.x, p.y]);
    expect(twoTwo).toEqual([
      [1, 8, 25],
      [2, 25, 15],
      [3, 25, 35],
      [4, 50, 15],
      [5, 50, 35],
    ]);
  });
});

describe('Demo behavior (standard futsal match)', () => {
  it('plays a full 1-2-1 vs 2-2 match with no script warnings or errors', async () => {
    const match = await runMatch(demoPayload(42, ONE_TWO_ONE, TWO_TWO));
    expect(match.frames.length).toBe(10800);

    const problems = match.frames
      .flatMap((frame) => frame.logs)
      .filter((log) => log.level === 'warn' || log.level === 'error');
    expect(problems).toEqual([]);
  }, 60_000);

  it('plays a full 2-2 vs 1-2-1 match with no script warnings or errors', async () => {
    const match = await runMatch(demoPayload(7, TWO_TWO, ONE_TWO_ONE));
    expect(match.frames.length).toBe(10800);

    const problems = match.frames
      .flatMap((frame) => frame.logs)
      .filter((log) => log.level === 'warn' || log.level === 'error');
    expect(problems).toEqual([]);
  }, 60_000);

  it('keeps both goalkeepers disciplined near their goal line', async () => {
    const match = await runMatch(demoPayload(42, ONE_TWO_ONE, TWO_TWO));

    for (const frame of match.frames) {
      const homeGk = playerBySlot(frame, 'challenger', 1);
      const awayGk = playerBySlot(frame, 'opponent', 1);
      // Sweeping keepers may chase wide corner balls but never abandon the
      // goal-mouth neighbourhood.
      expect(homeGk.y).toBeGreaterThanOrEqual(4);
      expect(homeGk.y).toBeLessThanOrEqual(46);
      expect(awayGk.y).toBeGreaterThanOrEqual(4);
      expect(awayGk.y).toBeLessThanOrEqual(46);
      expect(homeGk.x).toBeLessThanOrEqual(22);
      expect(awayGk.x).toBeGreaterThanOrEqual(78);
    }

    // Majority of the time on the keeper line.
    const homeOnLine = match.frames.filter((frame) => playerBySlot(frame, 'challenger', 1).x <= 12).length;
    const awayOnLine = match.frames.filter((frame) => playerBySlot(frame, 'opponent', 1).x >= 88).length;
    expect(homeOnLine / match.frames.length).toBeGreaterThan(0.5);
    expect(awayOnLine / match.frames.length).toBeGreaterThan(0.5);
  }, 60_000);

  it('moves the ball through teammates (passing game)', async () => {
    const match = await runMatch(demoPayload(42, ONE_TWO_ONE, TWO_TWO));

    expect(countTeamHandoffs(match.owners, 'challenger')).toBeGreaterThanOrEqual(5);
    expect(countTeamHandoffs(match.owners, 'opponent')).toBeGreaterThanOrEqual(5);
  }, 60_000);

  it('stays a sane arcade match (no degenerate scoreline)', async () => {
    const a = await runMatch(demoPayload(42, ONE_TWO_ONE, TWO_TWO));
    const b = await runMatch(demoPayload(7, TWO_TWO, ONE_TWO_ONE));

    const summary = `1-2-1 vs 2-2: ${a.sim.scoreChallenger}-${a.sim.scoreOpponent}; `
      + `2-2 vs 1-2-1: ${b.sim.scoreChallenger}-${b.sim.scoreOpponent}`;
    // Sanity ceiling: a team roughly scoring a goal every 15s would mean a
    // broken defensive shape (walk-in metronome), not a futsal match.
    expect(a.sim.scoreChallenger, summary).toBeLessThanOrEqual(10);
    expect(a.sim.scoreOpponent, summary).toBeLessThanOrEqual(10);
    expect(b.sim.scoreChallenger, summary).toBeLessThanOrEqual(10);
    expect(b.sim.scoreOpponent, summary).toBeLessThanOrEqual(10);
  }, 120_000);

  it('same seed + demo scripts produce byte-identical matches', async () => {
    const a = JSON.stringify(
      await new Simulation(demoPayload(2024, ONE_TWO_ONE, TWO_TWO), new IsolatedScriptRunner(integrationRunnerOptions)).run(),
    );
    const b = JSON.stringify(
      await new Simulation(demoPayload(2024, ONE_TWO_ONE, TWO_TWO), new IsolatedScriptRunner(integrationRunnerOptions)).run(),
    );
    expect(a).toBe(b);
  }, 60_000);
});
