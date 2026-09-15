import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EASY_BOT_OPPONENT_PLAYERS } from '../bots/easy/index.js';
import { IsolatedScriptRunner } from '../IsolatedScriptRunner.js';
import { Simulation } from '../Simulation.js';
import type { SimulatePayload } from '../types.js';

// StarterAI fixture: exact copy of AuthController::STARTER_AI_CODE (story 3.1).
const STARTER_AI = readFileSync(new URL('../bots/starter-ai.js', import.meta.url), 'utf8');

// Fixed seeds (no seed sampling): the balance contract (AC #2) must hold on
// these five, so CI failures are reproducible by seed.
const SEEDS = [11, 227, 3457, 60221, 987654];

// Full-match sandboxed runs use a generous tick deadline (see the 3.4 suite):
// a 10ms deadline can spuriously fire under CPU load and this test asserts
// balance, not the 10ms contract.
const integrationRunnerOptions = { tickTimeoutMs: 1000 };

function matchPayload(seed: number): SimulatePayload {
  return {
    match_id: `easy-bot-balance-${seed}`,
    seed,
    output_path: '/tmp/unused',
    challenger: {
      players: [
        { slot: 1, x: 8, y: 25, script: STARTER_AI },
        { slot: 2, x: 25, y: 15, script: STARTER_AI },
        { slot: 3, x: 25, y: 35, script: STARTER_AI },
        { slot: 4, x: 40, y: 15, script: STARTER_AI },
        { slot: 5, x: 40, y: 35, script: STARTER_AI },
      ],
    },
    opponent: { players: EASY_BOT_OPPONENT_PLAYERS.map((p) => ({ ...p })) },
  };
}

describe('Easy Bot balance (AC #2, v1.4 baseline)', () => {
  it('pins the StarterAI vs Easy Bot outcomes accepted by Pelo at v1.4 speeds', async () => {
    const results = [];
    for (const seed of SEEDS) {
      const file = await new Simulation(matchPayload(seed), new IsolatedScriptRunner(integrationRunnerOptions)).run();
      results.push({ seed, ...file.result });
    }

    // Baseline accepted by Pelo ("it is ok"), 2026-09-15, at game-rules.md
    // v1.4 speeds (PLAYER_SPEED 1/1.5, MAX_BALL_SPEED 5/1.75 x 0.8). Known
    // and accepted at these speeds: the full-speed ball out-runs
    // COLLISION_RADIUS so shots can tunnel past the keeper, and the outcome
    // landscape is bistable — a challenger walk-in metronome on seeds 11/227
    // and sterile midfields on the other seeds. These pins are a conscious
    // baseline: any physics, bot-script, or starter-fixture change that
    // shifts a score must re-pin them deliberately.
    const summary = results
      .map((r) => `seed ${r.seed}: ${r.score_challenger}-${r.score_opponent} (${r.winner})`)
      .join(', ');
    expect(results, `v1.4 baseline drifted [${summary}]`).toEqual([
      { seed: 11, score_challenger: 98, score_opponent: 0, winner: 'challenger' },
      { seed: 227, score_challenger: 98, score_opponent: 0, winner: 'challenger' },
      { seed: 3457, score_challenger: 0, score_opponent: 0, winner: 'draw' },
      { seed: 60221, score_challenger: 0, score_opponent: 0, winner: 'draw' },
      { seed: 987654, score_challenger: 0, score_opponent: 0, winner: 'draw' },
    ]);
  }, 600_000);
});
