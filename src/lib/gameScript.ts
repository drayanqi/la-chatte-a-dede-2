/**
 * Game script content helpers.
 * OWNER: Dev Team
 *
 * The script editor's TypeScript worker only knows the game API when the
 * `game` parameter is typed. Scripts therefore carry a JSDoc line above the
 * update function; `ensureGameApiJSDoc` adds it when missing so every
 * script gets IntelliSense (declarations come from gameApiDts.ts, fed from
 * the canonical gameApiTypes.ts contract).
 *
 * The line is STORED in the script (not injected at display time): comments
 * are no-ops in the sandbox and engine, and editor line numbers stay true,
 * which keeps future runtime-error markers aligned for free.
 */

export const GAME_API_JSDOC_LINE =
  '/** @param {Game} game - Game state: me, ball, teammates, opponents, field. */';

/**
 * A top-level `function update(` declaration: only whitespace may precede
 * it on the line, so text that merely CONTAINS "function update(" (e.g.
 * inside a string literal) does not match.
 */
const UPDATE_FUNCTION_PATTERN = /^[ \t]*function\s+update\s*\(/m;

export function hasGameApiJSDoc(code: string): boolean {
  return code.includes('/** @param {Game}');
}

/**
 * Returns the script with the Game API JSDoc line guaranteed above the
 * update function. Idempotent; scripts without a `function update(`
 * declaration are returned unchanged (the engine validator will report
 * them, not us).
 */
export function ensureGameApiJSDoc(code: string): string {
  if (hasGameApiJSDoc(code)) {
    return code;
  }
  const match = code.match(UPDATE_FUNCTION_PATTERN);
  if (match === null || match.index === undefined) {
    return code;
  }
  const lineStart = code.lastIndexOf('\n', match.index) + 1;
  return `${code.slice(0, lineStart)}${GAME_API_JSDOC_LINE}\n${code.slice(lineStart)}`;
}
