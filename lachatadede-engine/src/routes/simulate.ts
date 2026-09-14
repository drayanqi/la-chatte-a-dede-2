import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { IsolatedScriptRunner } from '../engine/IsolatedScriptRunner.js';
import { Simulation } from '../engine/Simulation.js';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  PLAYERS_PER_TEAM,
  TOTAL_TICKS,
} from '../engine/constants.js';
import type { SimulatePayload } from '../engine/types.js';

/**
 * Validates the POST /simulate payload.
 * Returns an empty array when the payload is valid, otherwise the problems found.
 */
export function validateSimulatePayload(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return ['body must be a JSON object'];
  }
  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof b.match_id !== 'string' || b.match_id.length === 0) {
    errors.push('match_id must be a non-empty string');
  } else if (/[\\/]/.test(b.match_id) || b.match_id.includes('..')) {
    // match_id is joined into the output file path: never let it traverse.
    errors.push('match_id must not contain path separators or ".."');
  }
  if (
    typeof b.seed !== 'number' ||
    !Number.isInteger(b.seed) ||
    b.seed < 0 ||
    b.seed > 4294967295
  ) {
    // The PRNG state is 32-bit; seeds outside [0, 2^32-1] would alias onto
    // other seeds (e.g. 0 and 4294967296 produce identical matches).
    errors.push('seed must be an integer in [0, 4294967295]');
  }
  if (typeof b.output_path !== 'string' || b.output_path.length === 0) {
    errors.push('output_path must be a non-empty string');
  }
  errors.push(...validateTeam(b.challenger, 'challenger'));
  errors.push(...validateTeam(b.opponent, 'opponent'));

  return errors;
}

function validateTeam(value: unknown, name: string): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [`${name} must be an object with a players array`];
  }
  const players = (value as { players?: unknown }).players;
  if (!Array.isArray(players)) {
    return [`${name}.players must be an array`];
  }
  const errors: string[] = [];
  if (players.length !== PLAYERS_PER_TEAM) {
    errors.push(`${name}.players must contain exactly ${PLAYERS_PER_TEAM} players, got ${players.length}`);
    return errors;
  }
  const seenSlots = new Set<number>();
  players.forEach((p, i) => {
    if (typeof p !== 'object' || p === null || Array.isArray(p)) {
      errors.push(`${name}.players[${i}] must be an object`);
      return;
    }
    const pl = p as Record<string, unknown>;
    if (typeof pl.slot !== 'number' || !Number.isInteger(pl.slot) || pl.slot < 1) {
      errors.push(`${name}.players[${i}].slot must be a positive integer`);
    } else if (seenSlots.has(pl.slot)) {
      errors.push(`${name}.players[${i}].slot must be unique within the team`);
    } else {
      seenSlots.add(pl.slot);
    }
    if (typeof pl.x !== 'number' || !Number.isFinite(pl.x) || pl.x < 0 || pl.x > FIELD_WIDTH) {
      errors.push(`${name}.players[${i}].x must be a number within [0, ${FIELD_WIDTH}]`);
    }
    if (typeof pl.y !== 'number' || !Number.isFinite(pl.y) || pl.y < 0 || pl.y > FIELD_HEIGHT) {
      errors.push(`${name}.players[${i}].y must be a number within [0, ${FIELD_HEIGHT}]`);
    }
    if (typeof pl.script !== 'string') {
      errors.push(`${name}.players[${i}].script must be a string`);
    }
  });
  return errors;
}

export async function simulateRoutes(app: FastifyInstance): Promise<void> {
  app.post('/simulate', async (request, reply) => {
    const validationErrors = validateSimulatePayload(request.body);
    if (validationErrors.length > 0) {
      return reply.code(422).send({ success: false, error: validationErrors.join('; ') });
    }

    const payload = request.body as SimulatePayload;
    // Sandboxed script execution (story 3.4): one isolate per player with
    // 8MB / 10ms / 30s limits. `errors` marks match-level execution problems.
    const runner = new IsolatedScriptRunner();
    try {
      // Deterministic full-match simulation (10800 ticks).
      const simulation = new Simulation(payload, runner);
      const frameFile = await simulation.run();

      // Write the frame file to {output_path}/{match_id}.json (create dir if
      // missing). Write to a temp file and rename so readers never observe a
      // partially written ~7MB JSON and a crash cannot corrupt the final file.
      const filePath = path.join(payload.output_path, `${payload.match_id}.json`);
      await mkdir(path.dirname(filePath), { recursive: true });
      const tempPath = `${filePath}.tmp`;
      await writeFile(tempPath, JSON.stringify(frameFile));
      await rename(tempPath, filePath);

      return {
        success: true as const,
        file: filePath,
        result: {
          score_challenger: frameFile.result.score_challenger,
          score_opponent: frameFile.result.score_opponent,
          duration_frames: TOTAL_TICKS,
        },
        errors: runner.matchErrors,
      };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        success: false as const,
        error: err instanceof Error ? err.message : 'internal simulation failure',
      });
    } finally {
      runner.dispose();
    }
  });
}
