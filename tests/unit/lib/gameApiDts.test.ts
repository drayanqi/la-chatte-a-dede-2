/**
 * Game API DTS generation unit tests.
 *
 * gameApiDts.ts turns the canonical gameApiTypes.ts contract into global
 * ambient declaration text for Monaco's TypeScript worker. The generated
 * text is what makes hover docs, signature help and deep completions work
 * in plain-JS AI scripts (with the stored JSDoc line, see gameScript.ts).
 */
import { describe, it, expect } from 'vitest';
import { generateGameApiDts, GAME_API_DTS } from '@/lib/gameApiDts';
import gameApiTypesSource from '@/lib/gameApiTypes.ts?raw';

describe('generateGameApiDts', () => {
  it('strips export keywords so declarations become global', () => {
    const source = `export interface Foo {\n  readonly bar: number;\n}\n\nexport type Baz = 'a' | 'b';\n`;
    const dts = generateGameApiDts(source);

    expect(dts).toContain('interface Foo {');
    expect(dts).toContain("type Baz = 'a' | 'b';");
    expect(dts).not.toMatch(/^export /m);
  });

  it('keeps the JSDoc documentation above declarations', () => {
    const source = `/**\n * Doc for foo.\n */\nexport interface Foo {\n  /** Doc for bar. */\n  readonly bar: number;\n}\n`;
    const dts = generateGameApiDts(source);

    expect(dts).toContain('Doc for foo.');
    expect(dts).toContain('Doc for bar.');
  });

  it('is deterministic for the same input', () => {
    expect(generateGameApiDts(gameApiTypesSource)).toBe(GAME_API_DTS);
  });
});

describe('GAME_API_DTS (generated from the real contract)', () => {
  it('contains every game API type as a global declaration', () => {
    for (const declaration of [
      'interface Vector2D',
      'interface Player',
      'interface SelfPlayer',
      'interface Ball',
      'interface Goal',
      'interface Zone',
      'interface Field',
      'interface Game',
      'type UpdateFunction',
    ]) {
      expect(GAME_API_DTS).toContain(declaration);
    }
    expect(GAME_API_DTS).not.toMatch(/^export /m);
  });

  it('declares the sandbox global game so param-less scripts are typed', () => {
    // The sandbox shim assigns globalThis.game before every update() call;
    // this declaration is what types `game` in plain-JS scripts that never
    // declare it (no parameter, no JSDoc line needed).
    expect(GAME_API_DTS).toMatch(/^declare const game: Game;$/m);
  });

  it('exposes the nested paths used for deep completions', () => {
    // game.ball.position. / ball.velocity.
    expect(GAME_API_DTS).toMatch(/readonly position: Vector2D/);
    expect(GAME_API_DTS).toMatch(/readonly velocity: \{ readonly vx: number; readonly vy: number \}/);    // field.zones.homeBox.
    expect(GAME_API_DTS).toMatch(/readonly homeBox: Zone/);
    // game.me. actions vs read-only teammates.
    expect(GAME_API_DTS).toMatch(/readonly me: SelfPlayer/);
    expect(GAME_API_DTS).toMatch(/readonly teammates: Player\[\]/);
    expect(GAME_API_DTS).toMatch(/moveToward\(x: number, y: number\): void/);
    // read-only players must not expose actions (JSDoc @example text may
    // mention them, so assert on the method signatures, not the words)
    const playerBlock = GAME_API_DTS.slice(
      GAME_API_DTS.indexOf('interface Player {'),
      GAME_API_DTS.indexOf('interface SelfPlayer'),
    );
    expect(playerBlock).not.toMatch(/moveToward\(x: number/);
    expect(playerBlock).not.toMatch(/dribble\(x: number/);
    expect(playerBlock).not.toMatch(/shoot\(x: number/);
  });

  it('documents the API so hover tooltips have content', () => {
    expect(GAME_API_DTS).toContain('WITHOUT the ball');
    expect(GAME_API_DTS).toContain('@param power - Shot power between 0.1 and 1.0');
  });

  it('marks the moveTo alias deprecated', () => {
    expect(GAME_API_DTS).toContain('@deprecated Use moveToward instead.');
  });
});
