import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { TOTAL_TICKS } from '../../engine/constants.js';
import type { SimulatePayload } from '../../engine/types.js';

function makePayload(outputPath: string): SimulatePayload {
  return {
    match_id: 'match-abc-123',
    seed: 12345,
    output_path: outputPath,
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

describe('POST /simulate', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'lachatadede-engine-test-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('runs the simulation, writes the frame file, and responds synchronously', async () => {
    const app = await buildApp();
    try {
      const outputDir = path.join(workDir, 'simulations');
      const res = await app.inject({
        method: 'POST',
        url: '/simulate',
        payload: makePayload(outputDir),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toEqual({
        success: true,
        file: path.join(outputDir, 'match-abc-123.json'),
        result: { score_challenger: 0, score_opponent: 0, duration_frames: TOTAL_TICKS },
      });

      const written = JSON.parse(await readFile(body.file as string, 'utf8'));
      expect(written.match_id).toBe('match-abc-123');
      expect(written.seed).toBe(12345);
      expect(written.total_frames).toBe(TOTAL_TICKS);
      expect(written.frames).toHaveLength(TOTAL_TICKS);
      expect(written.result).toEqual({ score_challenger: 0, score_opponent: 0, winner: 'draw' });
    } finally {
      await app.close();
    }
  });

  it('responds 422 with a list of validation problems on an invalid payload', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/simulate',
        payload: { match_id: '', seed: 1.5, challenger: {}, opponent: {} },
      });
      expect(res.statusCode).toBe(422);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe('string');
      expect(body.error).toContain('match_id');
      expect(body.error).toContain('seed');
    } finally {
      await app.close();
    }
  });

  it('responds 422 when match_id contains path separators or traversal', async () => {
    const app = await buildApp();
    try {
      for (const matchId of ['../evil', 'a/b', 'a\\b', '..']) {
        const payload = makePayload(workDir);
        payload.match_id = matchId;
        const res = await app.inject({ method: 'POST', url: '/simulate', payload });
        expect(res.statusCode).toBe(422);
        expect(res.json().error).toContain('match_id');
      }
    } finally {
      await app.close();
    }
  });

  it('responds 422 when seed is outside the 32-bit unsigned range', async () => {
    const app = await buildApp();
    try {
      for (const seed of [-1, 4294967296]) {
        const payload = makePayload(workDir);
        payload.seed = seed;
        const res = await app.inject({ method: 'POST', url: '/simulate', payload });
        expect(res.statusCode).toBe(422);
        expect(res.json().error).toContain('seed');
      }
    } finally {
      await app.close();
    }
  });

  it('accepts the boundary seeds 0 and 4294967295', async () => {
    const app = await buildApp();
    try {
      const outputDir = path.join(workDir, 'boundary');
      for (const seed of [0, 4294967295]) {
        const payload = makePayload(outputDir);
        payload.seed = seed;
        const res = await app.inject({ method: 'POST', url: '/simulate', payload });
        expect(res.statusCode).toBe(200);
      }
    } finally {
      await app.close();
    }
  });

  it('leaves no temp file behind after writing the frame file', async () => {
    const app = await buildApp();
    try {
      const outputDir = path.join(workDir, 'simulations');
      const res = await app.inject({
        method: 'POST',
        url: '/simulate',
        payload: makePayload(outputDir),
      });
      expect(res.statusCode).toBe(200);
      const entries = await readdir(outputDir);
      expect(entries).toEqual(['match-abc-123.json']);
    } finally {
      await app.close();
    }
  });

  it('responds 422 when a team does not have exactly 5 valid players', async () => {
    const app = await buildApp();
    try {
      const payload = makePayload(workDir);
      payload.challenger.players = payload.challenger.players.slice(0, 4);
      const res = await app.inject({ method: 'POST', url: '/simulate', payload });
      expect(res.statusCode).toBe(422);
      expect(res.json().error).toContain('challenger.players');
    } finally {
      await app.close();
    }
  });

  it('creates the output directory when it does not exist', async () => {
    const app = await buildApp();
    try {
      const outputDir = path.join(workDir, 'nested', 'simulations');
      const res = await app.inject({
        method: 'POST',
        url: '/simulate',
        payload: makePayload(outputDir),
      });
      expect(res.statusCode).toBe(200);
      await expect(readFile(path.join(outputDir, 'match-abc-123.json'), 'utf8')).resolves.toBeDefined();
    } finally {
      await app.close();
    }
  });

  it('responds 500 with success:false when the output cannot be written', async () => {
    const app = await buildApp();
    try {
      // A plain file used as the output directory makes mkdir/write fail.
      const blocker = path.join(workDir, 'blocker');
      await writeFile(blocker, 'not a directory');
      const outputDir = path.join(blocker, 'simulations');
      const res = await app.inject({
        method: 'POST',
        url: '/simulate',
        payload: makePayload(outputDir),
      });
      expect(res.statusCode).toBe(500);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it('produces byte-identical files for the same seed (determinism gate)', async () => {
    const app = await buildApp();
    try {
      const dirA = path.join(workDir, 'a');
      const dirB = path.join(workDir, 'b');
      await app.inject({ method: 'POST', url: '/simulate', payload: makePayload(dirA) });
      await app.inject({ method: 'POST', url: '/simulate', payload: makePayload(dirB) });
      const fileA = await readFile(path.join(dirA, 'match-abc-123.json'));
      const fileB = await readFile(path.join(dirB, 'match-abc-123.json'));
      expect(Buffer.compare(fileA, fileB)).toBe(0);
    } finally {
      await app.close();
    }
  });
});
