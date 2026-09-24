/**
 * Game script content helpers.
 * OWNER: Dev Team
 *
 * The script editor's TypeScript worker only knows the game API when the
 * `game` value it sees is typed. Two script styles exist (script-ia-api.md
 * v2.1):
 *  - global style (preferred): `function update() { game... }` reads the
 *    sandbox global declared in gameApiTypes.ts — typed with no JSDoc at all;
 *  - parameter style (legacy): `function update(game) { ... }` needs the
 *    stored JSDoc line above update; `ensureGameApiJSDoc` adds it when
 *    missing so legacy scripts keep IntelliSense (declarations come from
 *    gameApiDts.ts, fed from the canonical gameApiTypes.ts contract).
 *
 * The line is STORED in the script (not injected at display time): comments
 * are no-ops in the sandbox and engine, and editor line numbers stay true,
 * which keeps future runtime-error markers aligned for free.
 */

export const GAME_API_JSDOC_LINE =
  '/** @param {Game} game - Game state: me, ball, teammates, opponents, field. */';

/**
 * A top-level `function update(game` declaration with a `game` parameter:
 * only whitespace may precede it on the line, so text that merely CONTAINS
 * "function update(" (e.g. inside a string literal) does not match.
 * Param-less scripts are deliberately NOT matched — the sandbox global
 * types them with no JSDoc, and injecting a line there would be dead weight.
 */
const UPDATE_FUNCTION_PATTERN = /^[ \t]*function\s+update\s*\(\s*game\b/m;

export function hasGameApiJSDoc(code: string): boolean {
  return code.includes('/** @param {Game}');
}

/**
 * Returns the script with the Game API JSDoc line guaranteed above the
 * `game`-parameter update function. Idempotent. Scripts left unchanged:
 *  - param-less global-style scripts (valid; typed by the sandbox global),
 *  - scripts with no `function update(game)` declaration at all — including
 *    those missing any update function, which the engine validator reports
 *    (not us).
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
