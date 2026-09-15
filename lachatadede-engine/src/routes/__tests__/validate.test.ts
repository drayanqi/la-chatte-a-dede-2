import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { validateScriptCode } from '../../routes/validate.js';

const VALID_SCRIPT = `function update(game) {
  const { me, ball } = game;
  me.moveToward(ball.position.x, ball.position.y);
}`;

describe('validateScriptCode', () => {
  it('accepts a script that compiles and defines update(game)', () => {
    const result = validateScriptCode(VALID_SCRIPT, 'javascript');
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('accepts a script whose update is declared with const', () => {
    const result = validateScriptCode(`const update = (game) => { void game; };`, 'javascript');
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('accepts a script prefixed with the editor Game API JSDoc line', () => {
    // The script editor stores this line above update() to type the game
    // parameter for Monaco's TypeScript worker; comments are no-ops in the
    // sandbox, so validation must accept exactly what the editor produces.
    const result = validateScriptCode(
      `/** @param {Game} game - Game state. */\n${VALID_SCRIPT}`,
      'javascript',
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects a syntax error with the exact user line number', () => {
    const result = validateScriptCode(
      'function update(game) {\n  return function {;\n}',
      'javascript',
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.line).toBe(2);
    expect(result.errors[0]?.message).toContain('Unexpected token');
  });

  it('rejects a top-level runtime error', () => {
    const result = validateScriptCode('throw new Error("boom");', 'javascript');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toContain('boom');
  });

  it('rejects a script without an update function', () => {
    const result = validateScriptCode('var x = 1;', 'javascript');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toContain('missing update function');
  });

  it('rejects an empty script (nothing to run in a match)', () => {
    const result = validateScriptCode('', 'javascript');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toContain('missing update function');
  });

  it('rejects unsupported languages', () => {
    const result = validateScriptCode(VALID_SCRIPT, 'python');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toContain('unsupported language');
  });

  it('does not hang on a top-level infinite loop', () => {
    const start = performance.now();
    const result = validateScriptCode('while (true) {}', 'javascript');
    const elapsed = performance.now() - start;
    expect(result.valid).toBe(false);
    expect(elapsed).toBeLessThan(5000);
  });

  it('cannot reach the host module system', () => {
    const result = validateScriptCode("require('fs');", 'javascript');
    expect(result.valid).toBe(false);
  });
});

describe('POST /validate-script', () => {
  it('responds with the validation result for a valid script', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/validate-script',
        payload: { code: VALID_SCRIPT, language: 'javascript' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ valid: true, errors: [] });
    } finally {
      await app.close();
    }
  });

  it('responds with errors for an invalid script (200, validity is in the body)', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/validate-script',
        payload: { code: 'var x =', language: 'javascript' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.valid).toBe(false);
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0].message).toBeTruthy();
      expect(typeof body.errors[0].line).toBe('number');
    } finally {
      await app.close();
    }
  });

  it('responds 422 when code is missing or not a string', async () => {
    const app = await buildApp();
    try {
      for (const payload of [{}, { code: 42 }, { code: null }]) {
        const res = await app.inject({ method: 'POST', url: '/validate-script', payload });
        expect(res.statusCode).toBe(422);
        expect(res.json().error).toContain('code');
      }
    } finally {
      await app.close();
    }
  });

  it('defaults the language to javascript when omitted', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/validate-script',
        payload: { code: VALID_SCRIPT },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ valid: true, errors: [] });
    } finally {
      await app.close();
    }
  });
});
