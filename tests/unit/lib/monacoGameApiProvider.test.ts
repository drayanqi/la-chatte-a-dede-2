/**
 * Monaco Game API Completion Provider Unit Tests
 *
 * Tests the completion provider that provides autocomplete suggestions
 * for the canonical game API (game, me, ball, field, teammates, opponents).
 *
 * @see Story 2.4: Game API Autocomplete
 * @see Story 3.4: AI-API alignment (canonical script-ia-api.md v2.0 contract)
 * @priority P1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerGameApiCompletionProvider } from '@/lib/monacoGameApiProvider';

// Mock Monaco types
interface MockRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

interface MockPosition {
  lineNumber: number;
  column: number;
}

interface MockModel {
  getValueInRange: (range: MockRange) => string;
  getWordUntilPosition: (position: MockPosition) => { startColumn: number; endColumn: number };
}

interface MockCompletionItem {
  label: string;
  kind: number;
  insertText: string;
  insertTextRules?: number;
  detail: string;
  documentation: { value: string };
  range: MockRange;
}

interface MockCompletionList {
  suggestions: MockCompletionItem[];
}

// Create mock Monaco instance
function createMockMonaco() {
  const disposable = { dispose: vi.fn() };

  let registeredProvider: {
    triggerCharacters: string[];
    provideCompletionItems: (model: MockModel, position: MockPosition) => MockCompletionList;
  } | null = null;

  const monaco = {
    languages: {
      CompletionItemKind: {
        Method: 0,
        Property: 1,
        Field: 2,
        Variable: 3,
      },
      CompletionItemInsertTextRule: {
        InsertAsSnippet: 4,
      },
      registerCompletionItemProvider: vi.fn((language: string, provider) => {
        registeredProvider = provider;
        return disposable;
      }),
    },
    // Helper to access the registered provider for testing
    getRegisteredProvider: () => registeredProvider,
  };

  return { monaco, disposable };
}

// Helper to create mock model and position
function createMockModelAndPosition(textBeforeCursor: string): { model: MockModel; position: MockPosition } {
  const position: MockPosition = {
    lineNumber: 1,
    column: textBeforeCursor.length + 1,
  };

  const model: MockModel = {
    getValueInRange: vi.fn(() => textBeforeCursor),
    getWordUntilPosition: vi.fn(() => ({
      startColumn: textBeforeCursor.length + 1,
      endColumn: textBeforeCursor.length + 1,
    })),
  };

  return { model, position };
}

function getSuggestions(textBeforeCursor: string): MockCompletionItem[] {
  const { monaco } = createMockMonaco();
  registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
  const provider = monaco.getRegisteredProvider();
  const { model, position } = createMockModelAndPosition(textBeforeCursor);
  return provider?.provideCompletionItems(model, position)?.suggestions ?? [];
}

describe('Monaco Game API Completion Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Registration', () => {
    it('should register completion provider for javascript language', () => {
      // GIVEN: Mock Monaco instance
      const { monaco } = createMockMonaco();

      // WHEN: Registering the provider
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));

      // THEN: Provider should be registered for JavaScript
      expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
        'javascript',
        expect.objectContaining({
          triggerCharacters: ['.'],
        })
      );
    });

    it('should return disposable for cleanup', () => {
      // GIVEN: Mock Monaco instance
      const { monaco, disposable } = createMockMonaco();

      // WHEN: Registering the provider
      const result = registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));

      // THEN: Should return disposable
      expect(result).toBe(disposable);
      expect(result.dispose).toBeDefined();
    });

    it('should set dot as trigger character', () => {
      // GIVEN: Mock Monaco instance
      const { monaco } = createMockMonaco();

      // WHEN: Registering the provider
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));

      // THEN: Provider should have '.' as trigger character
      const provider = monaco.getRegisteredProvider();
      expect(provider?.triggerCharacters).toContain('.');
    });
  });

  describe('Controlled Player Completions (me.)', () => {
    it('should return canonical action methods and properties for "me."', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('me.');

      // THEN: Should return the canonical script-ia-api.md surface
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('moveToward');
      expect(labels).toContain('dribble');
      expect(labels).toContain('stop');
      expect(labels).toContain('shoot');
      expect(labels).toContain('isClosestToBall');
      expect(labels).toContain('position');
      expect(labels).toContain('hasBall');
      expect(labels).toContain('slot');
      expect(labels).toContain('team');
      // The superseded Epic-2 API must not be taught anymore
      expect(labels).not.toContain('moveTo');
      expect(labels).not.toContain('kick');
      expect(labels).not.toContain('kickBall');
      expect(labels).not.toContain('velocity');
    });

    it('should have correct completion kind for methods', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();
      const { model, position } = createMockModelAndPosition('me.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Methods should have Method kind
      const moveToward = result?.suggestions.find((s) => s.label === 'moveToward');
      expect(moveToward?.kind).toBe(monaco.languages.CompletionItemKind.Method);
    });

    it('should have correct completion kind for properties', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();
      const { model, position } = createMockModelAndPosition('me.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Properties should have Property kind
      const positionProp = result?.suggestions.find((s) => s.label === 'position');
      expect(positionProp?.kind).toBe(monaco.languages.CompletionItemKind.Property);
    });

    it('should have snippet insert for moveToward with placeholders', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('me.');

      // THEN: moveToward should have snippet with x, y placeholders
      const moveToward = suggestions.find((s) => s.label === 'moveToward');
      expect(moveToward?.insertText).toBe('moveToward(${1:x}, ${2:y})');
      expect(moveToward?.insertTextRules).toBe(4);
    });

    it('should have snippet insert for shoot with power placeholder', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('me.');

      // THEN: shoot should have snippet with x, y, power placeholders
      const shoot = suggestions.find((s) => s.label === 'shoot');
      expect(shoot?.insertText).toBe('shoot(${1:x}, ${2:y}, ${3:power})');
    });

    it('should include documentation for methods', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('me.');

      // THEN: Methods should have documentation
      const moveToward = suggestions.find((s) => s.label === 'moveToward');
      expect(moveToward?.documentation?.value).toContain('Move the player');
      expect(moveToward?.detail).toContain('moveToward');
      const shoot = suggestions.find((s) => s.label === 'shoot');
      expect(shoot?.documentation?.value).toContain('0.1 and 1.0');
    });
  });

  describe('Read-only Player Completions (teammates[0]., opponents[0].)', () => {
    it('should return read-only properties and isClosestToBall for "teammates[0]." (no action methods)', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('teammates[0].');

      // THEN: Read-only player surface: properties + isClosestToBall only
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('position');
      expect(labels).toContain('hasBall');
      expect(labels).toContain('slot');
      expect(labels).toContain('team');
      expect(labels).toContain('isClosestToBall');
      expect(labels).not.toContain('moveToward');
      expect(labels).not.toContain('dribble');
      expect(labels).not.toContain('shoot');
      expect(labels).not.toContain('stop');
    });

    it('should return read-only completions for "opponents[idx]." (no action methods)', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('opponents[idx].');

      // THEN: Read-only player surface
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('position');
      expect(labels).toContain('hasBall');
      expect(labels).not.toContain('moveToward');
      expect(labels).not.toContain('shoot');
    });

    it('should suggest the same surface for "teammates." before indexing', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('teammates.');

      // THEN: Read-only player surface
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('position');
      expect(labels).toContain('isClosestToBall');
    });
  });

  describe('Ball Completions (ball.)', () => {
    it('should return ball properties for "ball."', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('ball.');

      // THEN: Should return ball properties including owner
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('position');
      expect(labels).toContain('velocity');
      expect(labels).toContain('owner');
      // Ball has no methods in our API
      expect(labels).not.toContain('moveToward');
      expect(labels).not.toContain('isClosestToBall');
    });

    it('should have position property with documentation', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('ball.');

      // THEN: Position should have documentation
      const positionProp = suggestions.find((s) => s.label === 'position');
      expect(positionProp?.documentation?.value).toContain('position');
      expect(positionProp?.kind).toBe(1);
    });
  });

  describe('Field Completions (field.)', () => {
    it('should return field properties for "field."', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('field.');

      // THEN: Should return field dimensions, goals and zones
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('width');
      expect(labels).toContain('height');
      expect(labels).toContain('goals');
      expect(labels).toContain('zones');
    });
  });

  describe('Game Root Completions (game.)', () => {
    it('should return the game context members for "game."', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('game.');

      // THEN: Should return me, ball, teammates, opponents, field
      const labels = suggestions.map((s) => s.label);
      expect(labels).toEqual(expect.arrayContaining(['me', 'ball', 'teammates', 'opponents', 'field']));
    });
  });

  describe('Unknown Context', () => {
    it('should return empty suggestions for unknown variable', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('unknownVar.');

      // THEN: Should return empty suggestions
      expect(suggestions).toEqual([]);
    });

    it('should return empty suggestions for no dot context', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('function update(');

      // THEN: Should return empty suggestions
      expect(suggestions).toEqual([]);
    });

    it('should return empty suggestions for partial variable name', () => {
      // WHEN: Getting completions (no dot yet)
      const suggestions = getSuggestions('me');

      // THEN: Should return empty suggestions
      expect(suggestions).toEqual([]);
    });
  });

  describe('Context Detection Edge Cases', () => {
    it('should handle code with existing content before variable', () => {
      // WHEN: Getting completions after an if-block
      const suggestions = getSuggestions('if (me.isClosestToBall()) { me.');

      // THEN: Should still detect "me." context
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('moveToward');
    });

    it('should handle whitespace after dot', () => {
      // WHEN: Getting completions with trailing whitespace
      const suggestions = getSuggestions('me. ');

      // THEN: Should still return player completions
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain('moveToward');
    });
  });

  describe('Tab/Enter Selection', () => {
    it('should have correct insertText for isClosestToBall method', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('me.');

      // THEN: isClosestToBall should insert without parameters
      const isClosestToBall = suggestions.find((s) => s.label === 'isClosestToBall');
      expect(isClosestToBall?.insertText).toBe('isClosestToBall()');
    });

    it('should have property insertText without parentheses', () => {
      // WHEN: Getting completions
      const suggestions = getSuggestions('ball.');

      // THEN: position property should insert just the property name
      const positionProp = suggestions.find((s) => s.label === 'position');
      expect(positionProp?.insertText).toBe('position');
    });
  });
});
