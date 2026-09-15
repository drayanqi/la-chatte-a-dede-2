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

describe('Easy Bot balance (AC #2)', () => {
  it('StarterAI reliably scores against the Easy Bot while the bot stays competitive', async () => {
    const results = [];
    for (const seed of SEEDS) {
      const file = await new Simulation(matchPayload(seed), new IsolatedScriptRunner(integrationRunnerOptions)).run();
      results.push({ seed, ...file.result });
    }

    // AC #2: the starter has a reasonable chance to score, the bot scores but
    // is beatable, and neither side runs away with the match.
    // Blowout guard at 10 (accepted by Pelo, 2026-09-15): the engine's
    // bistable attractors cap every both-sides-score bot configuration at 10
    // goals on seeds 60221/987654; the primary contract is that both sides
    // score and neither side blows out, so 10 is the accepted ceiling.
    const blowoutGuard = 10;
    const starterScores = results.map((r) => r.score_challenger);
    const botScores = results.map((r) => r.score_opponent);
    const summary = results
      .map((r) => `seed ${r.seed}: ${r.score_challenger}-${r.score_opponent} (${r.winner})`)
      .join(', ');

    expect(
      starterScores.filter((s) => s >= 1).length,
      `starter should score in >=3/5 seeds [${summary}]`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      botScores.filter((s) => s >= 1).length,
      `bot should score in >=3/5 seeds [${summary}]`,
    ).toBeGreaterThanOrEqual(3);
    for (const score of [...starterScores, ...botScores]) {
      expect(score, `blowout guard [${summary}]`).toBeLessThanOrEqual(blowoutGuard);
    }
  }, 600_000);
});
