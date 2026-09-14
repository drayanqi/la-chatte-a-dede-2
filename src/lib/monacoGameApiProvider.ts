/**
 * Monaco Game API Completion Provider
 * OWNER: Dev Team
 *
 * Provides autocomplete suggestions for the canonical game API
 * (script-ia-api.md v2.0) in AI scripts. Registers a CompletionItemProvider
 * that triggers on '.' after known objects:
 *   game. | me. | ball. | field. | teammates[i]. | opponents[i].
 *
 * @see Story 2.4: Game API Autocomplete
 * @see Story 3.4: AI-API alignment with the engine contract
 */

import type * as Monaco from 'monaco-editor';

/**
 * Context types that trigger different completions
 */
type CompletionContext = 'me' | 'otherPlayer' | 'ball' | 'field' | 'game' | 'unknown';

/**
 * Variable that maps to the controlled player (has action methods)
 */
const ME_VARIABLES = new Set(['me']);

/**
 * Variable names that map to read-only player context (teammates[i], opponents[i])
 */
const OTHER_PLAYER_VARIABLES = new Set(['teammates', 'opponents']);

/**
 * Variable names that map to ball context
 */
const BALL_VARIABLES = new Set(['ball']);

/**
 * Variable names that map to field context
 */
const FIELD_VARIABLES = new Set(['field']);

/**
 * Variable names that map to the game root object
 */
const GAME_VARIABLES = new Set(['game']);

/**
 * Detect the completion context based on the text before the cursor
 */
function detectContext(textBeforeCursor: string): CompletionContext {
  // Match variable name followed by optional array access and then '.'
  // Examples: "me.", "ball.", "game.", "teammates[0].", "opponents[idx]."
  const match = textBeforeCursor.match(/(\w+)(?:\[[^\]]*\])?\.\s*$/);

  if (!match) {
    return 'unknown';
  }

  const variableName = match[1] ?? '';

  if (ME_VARIABLES.has(variableName)) {
    return 'me';
  }

  // Read-only player array access (teammates[i], opponents[i])
  if (OTHER_PLAYER_VARIABLES.has(variableName)) {
    return 'otherPlayer';
  }

  if (BALL_VARIABLES.has(variableName)) {
    return 'ball';
  }

  if (FIELD_VARIABLES.has(variableName)) {
    return 'field';
  }

  if (GAME_VARIABLES.has(variableName)) {
    return 'game';
  }

  return 'unknown';
}

/**
 * Create a CompletionItem for a method
 */
function createMethodCompletion(
  monaco: typeof Monaco,
  range: Monaco.IRange,
  label: string,
  insertText: string,
  detail: string,
  documentation: string
): Monaco.languages.CompletionItem {
  return {
    label,
    kind: monaco.languages.CompletionItemKind.Method,
    insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail,
    documentation: {
      value: documentation,
    },
    range,
  };
}

/**
 * Create a CompletionItem for a property
 */
function createPropertyCompletion(
  monaco: typeof Monaco,
  range: Monaco.IRange,
  label: string,
  detail: string,
  documentation: string
): Monaco.languages.CompletionItem {
  return {
    label,
    kind: monaco.languages.CompletionItemKind.Property,
    insertText: label,
    detail,
    documentation: {
      value: documentation,
    },
    range,
  };
}

/**
 * Get completion items for the controlled player (me.)
 */
function getMeCompletions(
  monaco: typeof Monaco,
  range: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  return [
    // Action methods
    createMethodCompletion(
      monaco,
      range,
      'moveToward',
      'moveToward(${1:x}, ${2:y})',
      '(method) moveToward(x: number, y: number): void',
      'Move the player toward the specified coordinates WITHOUT the ball.\n\n' +
        'If the player had the ball, it is dropped at the current position.\n\n' +
        '**Parameters:**\n' +
        '- `x`: Target X coordinate (0-100)\n' +
        '- `y`: Target Y coordinate (0-50)\n\n' +
        '**Example:**\n```javascript\nme.moveToward(ball.position.x, ball.position.y);\n```'
    ),
    createMethodCompletion(
      monaco,
      range,
      'dribble',
      'dribble(${1:x}, ${2:y})',
      '(method) dribble(x: number, y: number): void',
      'Move the player toward the specified coordinates WITH the ball.\n' +
        'The ball follows the player.\n\n' +
        '**Parameters:**\n' +
        '- `x`: Target X coordinate (0-100)\n' +
        '- `y`: Target Y coordinate (0-50)\n\n' +
        '**Example:**\n```javascript\nme.dribble(75, 30);\n```'
    ),
    createMethodCompletion(
      monaco,
      range,
      'stop',
      'stop()',
      '(method) stop(): void',
      'Stop the player immediately. The player keeps the ball if they had it.\n\n' +
        '**Example:**\n```javascript\nme.stop();\n```'
    ),
    createMethodCompletion(
      monaco,
      range,
      'shoot',
      'shoot(${1:x}, ${2:y}, ${3:power})',
      '(method) shoot(x: number, y: number, power: number): void',
      'Shoot the ball toward a position. The ball travels in a straight line at\n' +
        '`power * 5` units per tick and can be intercepted.\n\n' +
        '**Parameters:**\n' +
        '- `x`: Target X coordinate (0-100)\n' +
        '- `y`: Target Y coordinate (0-50)\n' +
        '- `power`: Shot power between 0.1 and 1.0\n\n' +
        '**Example:**\n```javascript\nme.shoot(100, 25, 1.0); // Full-power shot\n```'
    ),
    createMethodCompletion(
      monaco,
      range,
      'isClosestToBall',
      'isClosestToBall()',
      '(method) isClosestToBall(): boolean',
      'Check if this player is the closest to the ball among teammates.\n\n' +
        '**Returns:** `true` if this player is closest to the ball\n\n' +
        '**Example:**\n```javascript\nif (me.isClosestToBall()) {\n  me.moveToward(ball.position.x, ball.position.y);\n}\n```'
    ),
    // Properties
    createPropertyCompletion(
      monaco,
      range,
      'position',
      '(property) position: { x: number; y: number }',
      'Current position of the player on the pitch.\n\n' +
        '**Properties:**\n' +
        '- `x`: Horizontal position (0-100)\n' +
        '- `y`: Vertical position (0-50)\n\n' +
        '**Example:**\n```javascript\nconst myX = me.position.x;\nconst myY = me.position.y;\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'hasBall',
      '(property) hasBall: boolean',
      'Whether this player currently holds the ball.\n\n' +
        '**Example:**\n```javascript\nif (me.hasBall) {\n  me.shoot(100, 25, 1.0);\n}\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'slot',
      '(property) slot: 1 | 2 | 3 | 4 | 5',
      "The player's slot number within their team (1 to 5).\n\n" +
        '**Example:**\n```javascript\nif (me.slot === 1) {\n  // Goalkeeper logic\n}\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'team',
      "(property) team: 'home' | 'away'",
      "The player's team: 'home' attacks toward x=100, 'away' attacks toward x=0.\n\n" +
        '**Example:**\n```javascript\nconst goalX = me.team === \'home\' ? 100 : 0;\n```'
    ),
  ];
}

/**
 * Get completion items for read-only players (teammates[i], opponents[i])
 */
function getOtherPlayerCompletions(
  monaco: typeof Monaco,
  range: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  return [
    createMethodCompletion(
      monaco,
      range,
      'isClosestToBall',
      'isClosestToBall()',
      '(method) isClosestToBall(): boolean',
      'Check if this player is the closest to the ball among teammates.\n\n' +
        '**Returns:** `true` if this player is closest to the ball\n\n' +
        '**Example:**\n```javascript\nif (game.teammates[0].isClosestToBall()) {\n  // Let them take the ball\n}\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'position',
      '(property) position: { x: number; y: number }',
      'Current position of the player on the pitch.\n\n' +
        '**Properties:**\n' +
        '- `x`: Horizontal position (0-100)\n' +
        '- `y`: Vertical position (0-50)\n\n' +
        '**Example:**\n```javascript\nconst mateX = game.teammates[0].position.x;\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'hasBall',
      '(property) hasBall: boolean',
      'Whether this player currently holds the ball.\n\n' +
        '**Example:**\n```javascript\nif (game.opponents[0].hasBall) {\n  // Defend!\n}\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'slot',
      '(property) slot: 1 | 2 | 3 | 4 | 5',
      "The player's slot number within their team (1 to 5)."
    ),
    createPropertyCompletion(
      monaco,
      range,
      'team',
      "(property) team: 'home' | 'away'",
      "The player's team: 'home' or 'away'."
    ),
  ];
}

/**
 * Get completion items for Ball object
 */
function getBallCompletions(
  monaco: typeof Monaco,
  range: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  return [
    createPropertyCompletion(
      monaco,
      range,
      'position',
      '(property) position: { x: number; y: number }',
      'Current position of the ball on the pitch.\n\n' +
        '**Properties:**\n' +
        '- `x`: Horizontal position\n' +
        '- `y`: Vertical position\n\n' +
        '**Example:**\n```javascript\nme.moveToward(ball.position.x, ball.position.y);\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'velocity',
      '(property) velocity: { vx: number; vy: number }',
      'Current velocity of the ball in units per tick.\n\n' +
        '**Properties:**\n' +
        '- `vx`: Horizontal velocity\n' +
        '- `vy`: Vertical velocity\n\n' +
        '**Example:**\n```javascript\n// Predict where the ball will be in 10 ticks\nconst futureX = ball.position.x + ball.velocity.vx * 10;\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'owner',
      '(property) owner: string | null',
      'Id of the player owning the ball (e.g. "home-3"), or null when free.\n\n' +
        '**Example:**\n```javascript\nif (ball.owner === null) {\n  // Ball is free: go get it\n}\n```'
    ),
  ];
}

/**
 * Get completion items for Field object
 */
function getFieldCompletions(
  monaco: typeof Monaco,
  range: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  return [
    createPropertyCompletion(
      monaco,
      range,
      'width',
      '(property) width: number',
      'Pitch width (100).\n\n' +
        '**Example:**\n```javascript\nconst rightEdge = game.field.width;\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'height',
      '(property) height: number',
      'Pitch height (50).\n\n' +
        '**Example:**\n```javascript\nconst bottomEdge = game.field.height;\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'goals',
      "(property) goals: { home: { x, y, width }; away: { x, y, width } }",
      'The two goals: `home` at x=0, `away` at x=100, both centered at y=25 with width 20.\n\n' +
        '**Example:**\n```javascript\nconst target = game.field.goals.away;\nme.shoot(target.x, target.y, 1.0);\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'zones',
      '(property) zones: { homeBox, awayBox, center }',
      'Key pitch zones: `homeBox`, `awayBox` (penalty boxes) and `center` (kickoff spot).\n\n' +
        '**Example:**\n```javascript\nconst center = game.field.zones.center;\n```'
    ),
  ];
}

/**
 * Get completion items for the game root object
 */
function getGameCompletions(
  monaco: typeof Monaco,
  range: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  return [
    createPropertyCompletion(
      monaco,
      range,
      'me',
      '(property) me: Player',
      'The player this script controls (the only one with action methods like moveToward).'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'ball',
      '(property) ball: Ball',
      'The ball (position, velocity, owner).'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'teammates',
      '(property) teammates: Player[]',
      'Your teammates, excluding yourself (read-only).'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'opponents',
      '(property) opponents: Player[]',
      'The opponents (read-only).'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'field',
      '(property) field: Field',
      'The pitch: dimensions, goals and zones.'
    ),
  ];
}

/**
 * Disposable interface for cleanup
 */
export interface GameApiProviderDisposable {
  dispose: () => void;
}

/**
 * Register the Game API completion provider for JavaScript language.
 *
 * @param monaco - Monaco instance from @monaco-editor/react
 * @returns Disposable that can be used to unregister the provider
 *
 * @example
 * const disposable = registerGameApiCompletionProvider(monaco);
 * // Later, to cleanup:
 * disposable.dispose();
 */
export function registerGameApiCompletionProvider(
  monaco: typeof Monaco
): GameApiProviderDisposable {
  const disposable = monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['.'],

    provideCompletionItems: (
      model: Monaco.editor.ITextModel,
      position: Monaco.Position
    ): Monaco.languages.ProviderResult<Monaco.languages.CompletionList> => {
      // Get text from start of line to cursor position
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Detect what context we're in
      const context = detectContext(textUntilPosition);

      if (context === 'unknown') {
        return { suggestions: [] };
      }

      // Get word at position for the range
      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn,
      };

      // Return appropriate completions based on context
      let suggestions: Monaco.languages.CompletionItem[] = [];

      switch (context) {
        case 'me':
          suggestions = getMeCompletions(monaco, range);
          break;
        case 'otherPlayer':
          suggestions = getOtherPlayerCompletions(monaco, range);
          break;
        case 'ball':
          suggestions = getBallCompletions(monaco, range);
          break;
        case 'field':
          suggestions = getFieldCompletions(monaco, range);
          break;
        case 'game':
          suggestions = getGameCompletions(monaco, range);
          break;
      }

      return { suggestions };
    },
  });

  return disposable;
}
