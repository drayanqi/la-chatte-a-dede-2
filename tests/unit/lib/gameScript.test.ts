/**
 * Game script content helper unit tests (Game API JSDoc line).
 *
 * The stored `@param {Game} game` JSDoc line is what types the `game`
 * parameter for the editor's TypeScript worker; ensureGameApiJSDoc adds it
 * to any script that lost it (legacy scripts, hand-stripped code).
 */
import { describe, it, expect } from 'vitest';
import {
  ensureGameApiJSDoc,
  hasGameApiJSDoc,
  GAME_API_JSDOC_LINE,
} from '@/lib/gameScript';

describe('hasGameApiJSDoc', () => {
  it('detects the Game API JSDoc line', () => {
    expect(hasGameApiJSDoc(`${GAME_API_JSDOC_LINE}\nfunction update(game) {}`)).toBe(true);
    expect(hasGameApiJSDoc('/** @param {Game} g */\nfunction update(game) {}')).toBe(true);
  });

  it('is false for scripts without it', () => {
    expect(hasGameApiJSDoc('function update(game) {}')).toBe(false);
    expect(hasGameApiJSDoc('')).toBe(false);
  });
});

describe('ensureGameApiJSDoc', () => {
  it('inserts the JSDoc line directly above the update function', () => {
    const code = '// My bot\nfunction update(game) {\n  game.me.stop();\n}\n';
    const result = ensureGameApiJSDoc(code);

    expect(result).toBe(
      `// My bot\n${GAME_API_JSDOC_LINE}\nfunction update(game) {\n  game.me.stop();\n}\n`,
    );
  });

  it('keeps header comments above the inserted line', () => {
    const code = '// Header line\n// Created today\nfunction update(game) {}\n';
    const result = ensureGameApiJSDoc(code);
    const lines = result.split('\n');

    expect(lines[0]).toBe('// Header line');
    expect(lines[2]).toBe(GAME_API_JSDOC_LINE);
    expect(lines[3]).toBe('function update(game) {}');
  });

  it('is idempotent', () => {
    const once = ensureGameApiJSDoc('function update(game) {}');
    expect(ensureGameApiJSDoc(once)).toBe(once);
  });

  it('leaves scripts that already document game untouched', () => {
    const code = '/** @param {Game} game */\nfunction update(game) {}';
    expect(ensureGameApiJSDoc(code)).toBe(code);
  });

  it('returns scripts without an update function unchanged', () => {
    expect(ensureGameApiJSDoc('')).toBe('');
    expect(ensureGameApiJSDoc('var x = 1;')).toBe('var x = 1;');
    expect(ensureGameApiJSDoc('// comment only')).toBe('// comment only');
  });

  it('ignores "function update(" appearing mid-line (string literals)', () => {
    const code = 'console.log("call function update(game) first");';
    expect(ensureGameApiJSDoc(code)).toBe(code);
  });

  it('documents the known gap: const-declared update is left unchanged', () => {
    const code = 'const update = (game) => { void game; };';
    expect(ensureGameApiJSDoc(code)).toBe(code);
  });
});
