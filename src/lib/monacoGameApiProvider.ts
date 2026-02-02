/**
 * Monaco Game API Completion Provider
 * OWNER: Dev Team
 *
 * Provides autocomplete suggestions for the game API in AI scripts.
 * Registers a CompletionItemProvider that triggers on '.' after known objects.
 *
 * @see Story 2.4: Game API Autocomplete
 */

import type * as Monaco from 'monaco-editor';

/**
 * Context types that trigger different completions
 */
type CompletionContext = 'player' | 'ball' | 'goal' | 'unknown';

/**
 * Variable names that map to player context (me, teammates[i], opponents[i])
 */
const PLAYER_VARIABLES = new Set(['me', 'player']);

/**
 * Variable names that map to ball context
 */
const BALL_VARIABLES = new Set(['ball']);

/**
 * Variable names that map to goal context
 */
const GOAL_VARIABLES = new Set(['goal']);

/**
 * Variable names that are player arrays
 */
const PLAYER_ARRAY_VARIABLES = new Set(['teammates', 'opponents']);

/**
 * Detect the completion context based on the text before the cursor
 */
function detectContext(textBeforeCursor: string): CompletionContext {
  // Match variable name followed by optional array access and then '.'
  // Examples: "me.", "ball.", "teammates[0].", "opponents[idx]."
  const match = textBeforeCursor.match(/(\w+)(?:\[[^\]]*\])?\.\s*$/);

  if (!match) {
    return 'unknown';
  }

  const variableName = match[1];

  // Direct player variables
  if (PLAYER_VARIABLES.has(variableName)) {
    return 'player';
  }

  // Player array access (teammates[i], opponents[i])
  if (PLAYER_ARRAY_VARIABLES.has(variableName)) {
    return 'player';
  }

  // Ball variable
  if (BALL_VARIABLES.has(variableName)) {
    return 'ball';
  }

  // Goal variable
  if (GOAL_VARIABLES.has(variableName)) {
    return 'goal';
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
 * Get completion items for Player objects (me, teammates[i], opponents[i])
 */
function getPlayerCompletions(
  monaco: typeof Monaco,
  range: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  return [
    // Methods
    createMethodCompletion(
      monaco,
      range,
      'moveTo',
      'moveTo(${1:x}, ${2:y})',
      '(method) moveTo(x: number, y: number): void',
      'Move the player toward the specified coordinates.\n\n' +
        '**Parameters:**\n' +
        '- `x`: Target X coordinate to move toward\n' +
        '- `y`: Target Y coordinate to move toward\n\n' +
        '**Example:**\n```javascript\nme.moveTo(ball.position.x, ball.position.y);\n```'
    ),
    createMethodCompletion(
      monaco,
      range,
      'kick',
      'kick(${1:force}, ${2:angle})',
      '(method) kick(force?: number, angle?: number): void',
      'Kick the ball if close enough to it.\n\n' +
        '**Parameters:**\n' +
        '- `force` (optional): Kick power from 0-100 (default: 50)\n' +
        '- `angle` (optional): Kick angle in radians (default: toward goal)\n\n' +
        '**Example:**\n```javascript\nme.kick(); // Simple kick\nme.kick(100, Math.PI / 4); // Powerful kick at 45°\n```'
    ),
    createMethodCompletion(
      monaco,
      range,
      'isClosestToBall',
      'isClosestToBall()',
      '(method) isClosestToBall(): boolean',
      'Check if this player is the closest to the ball among teammates.\n\n' +
        '**Returns:** `true` if this player is closest to the ball\n\n' +
        '**Example:**\n```javascript\nif (me.isClosestToBall()) {\n  me.moveTo(ball.position.x, ball.position.y);\n}\n```'
    ),
    // Properties
    createPropertyCompletion(
      monaco,
      range,
      'position',
      '(property) position: { x: number; y: number }',
      'Current position of the player on the pitch.\n\n' +
        '**Properties:**\n' +
        '- `x`: Horizontal position\n' +
        '- `y`: Vertical position\n\n' +
        '**Example:**\n```javascript\nconst myX = me.position.x;\nconst myY = me.position.y;\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'velocity',
      '(property) velocity: { x: number; y: number }',
      'Current velocity of the player (direction and speed).\n\n' +
        '**Properties:**\n' +
        '- `x`: Horizontal velocity\n' +
        '- `y`: Vertical velocity\n\n' +
        '**Example:**\n```javascript\nif (me.velocity.x > 0) {\n  // Player is moving right\n}\n```'
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
        '**Example:**\n```javascript\nme.moveTo(ball.position.x, ball.position.y);\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'velocity',
      '(property) velocity: { x: number; y: number }',
      'Current velocity of the ball (direction and speed).\n\n' +
        '**Properties:**\n' +
        '- `x`: Horizontal velocity\n' +
        '- `y`: Vertical velocity\n\n' +
        '**Example:**\n```javascript\n// Predict where the ball will be\nconst futureX = ball.position.x + ball.velocity.x * 10;\n```'
    ),
  ];
}

/**
 * Get completion items for Goal object
 */
function getGoalCompletions(
  monaco: typeof Monaco,
  range: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  return [
    createPropertyCompletion(
      monaco,
      range,
      'position',
      '(property) position: { x: number; y: number }',
      "Position of the center of the goal.\n\n" +
        '**Properties:**\n' +
        '- `x`: Horizontal position\n' +
        '- `y`: Vertical position\n\n' +
        '**Example:**\n```javascript\nconst dx = goal.position.x - ball.position.x;\nconst dy = goal.position.y - ball.position.y;\nconst angle = Math.atan2(dy, dx);\n```'
    ),
    createPropertyCompletion(
      monaco,
      range,
      'width',
      '(property) width: number',
      'Width of the goal opening.\n\n' +
        '**Example:**\n```javascript\n// Aim at a random point within the goal\nconst targetY = goal.position.y + (Math.random() - 0.5) * goal.width;\n```'
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
        case 'player':
          suggestions = getPlayerCompletions(monaco, range);
          break;
        case 'ball':
          suggestions = getBallCompletions(monaco, range);
          break;
        case 'goal':
          suggestions = getGoalCompletions(monaco, range);
          break;
      }

      return { suggestions };
    },
  });

  return disposable;
}
