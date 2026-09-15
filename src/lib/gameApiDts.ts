/**
 * Game API ambient declarations for the script editor's TypeScript worker.
 * OWNER: Dev Team
 *
 * Monaco's JavaScript support is backed by the real TypeScript language
 * service. Feeding it the game API as an extra lib (via
 * `javascriptDefaults.addExtraLib`, see monacoSetup.ts) is what provides
 * hover documentation, signature help and deep completions
 * (`game.ball.position.` -> x, y, enum literals, ...) in AI scripts.
 *
 * The declarations are generated at runtime from the canonical contract
 * `gameApiTypes.ts` (imported as raw text): export keywords are stripped so
 * every interface lives in the global scope. That is what lets the stored
 * `@param {Game} game` JSDoc line resolve the `Game` type in plain-JS
 * scripts (see gameScript.ts). There is deliberately no copy of the API
 * surface here — edit gameApiTypes.ts only.
 */

const HEADER = `/**
 * Game API declarations for AI scripts (editor ambient types).
 *
 * GENERATED from src/lib/gameApiTypes.ts by src/lib/gameApiDts.ts —
 * do not edit this text: edit the source file instead.
 * Types are global so plain-JS scripts can reference them via JSDoc.
 */

`;

/**
 * Converts the `gameApiTypes.ts` module source (exported interfaces) into
 * global ambient declaration text usable by `addExtraLib`.
 */
export function generateGameApiDts(moduleSource: string): string {
  const body = moduleSource
    .split('\n')
    .map((line) => line.replace(/^export (?=(?:interface|type)\b)/, ''))
    .join('\n')
    .trim();
  return `${HEADER}${body}\n`;
}

import gameApiTypesSource from './gameApiTypes.ts?raw';

/** The extra lib text registered with Monaco's JavaScript worker. */
export const GAME_API_DTS: string = generateGameApiDts(gameApiTypesSource);
