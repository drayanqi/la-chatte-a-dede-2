/**
 * Monaco Game API Completion Provider Unit Tests
 *
 * Tests the completion provider that provides autocomplete suggestions
 * for the game API (me, ball, goal, teammates, opponents).
 *
 * @see Story 2.4: Game API Autocomplete
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

  describe('Player Completions (me.)', () => {
    it('should return player methods for "me."', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('me.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should return player methods and properties
      expect(result?.suggestions).toBeDefined();
      expect(result?.suggestions.length).toBeGreaterThan(0);

      const labels = result?.suggestions.map((s) => s.label);
      expect(labels).toContain('moveTo');
      expect(labels).toContain('kick');
      expect(labels).toContain('isClosestToBall');
      expect(labels).toContain('position');
      expect(labels).toContain('velocity');
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
      const moveTo = result?.suggestions.find((s) => s.label === 'moveTo');
      expect(moveTo?.kind).toBe(monaco.languages.CompletionItemKind.Method);
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
      const position_prop = result?.suggestions.find((s) => s.label === 'position');
      expect(position_prop?.kind).toBe(monaco.languages.CompletionItemKind.Property);
    });

    it('should have snippet insert for moveTo with placeholders', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('me.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: moveTo should have snippet with x, y placeholders
      const moveTo = result?.suggestions.find((s) => s.label === 'moveTo');
      expect(moveTo?.insertText).toBe('moveTo(${1:x}, ${2:y})');
      expect(moveTo?.insertTextRules).toBe(monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet);
    });

    it('should include documentation for methods', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('me.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Methods should have documentation
      const moveTo = result?.suggestions.find((s) => s.label === 'moveTo');
      expect(moveTo?.documentation?.value).toContain('Move the player');
      expect(moveTo?.detail).toContain('moveTo');
    });
  });

  describe('Player Array Completions (teammates[0]., opponents[0].)', () => {
    it('should return player methods for "teammates."', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('teammates.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should return player methods (for array access context)
      const labels = result?.suggestions.map((s) => s.label);
      expect(labels).toContain('moveTo');
      expect(labels).toContain('position');
    });

    it('should return player methods for "teammates[0]."', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('teammates[0].');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should return player methods
      const labels = result?.suggestions.map((s) => s.label);
      expect(labels).toContain('moveTo');
      expect(labels).toContain('kick');
    });

    it('should return player methods for "opponents[idx]."', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('opponents[idx].');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should return player methods
      const labels = result?.suggestions.map((s) => s.label);
      expect(labels).toContain('position');
      expect(labels).toContain('velocity');
    });
  });

  describe('Ball Completions (ball.)', () => {
    it('should return ball properties for "ball."', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('ball.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should return ball properties
      const labels = result?.suggestions.map((s) => s.label);
      expect(labels).toContain('position');
      expect(labels).toContain('velocity');
      // Ball has no methods in our API
      expect(labels).not.toContain('moveTo');
      expect(labels).not.toContain('kick');
    });

    it('should have position property with documentation', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('ball.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Position should have documentation
      const positionProp = result?.suggestions.find((s) => s.label === 'position');
      expect(positionProp?.documentation?.value).toContain('position');
      expect(positionProp?.kind).toBe(monaco.languages.CompletionItemKind.Property);
    });
  });

  describe('Goal Completions (goal.)', () => {
    it('should return goal properties for "goal."', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('goal.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should return goal properties
      const labels = result?.suggestions.map((s) => s.label);
      expect(labels).toContain('position');
      expect(labels).toContain('width');
      // Goal has no methods
      expect(labels).not.toContain('moveTo');
    });

    it('should have width property', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('goal.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Width should exist and have documentation
      const width = result?.suggestions.find((s) => s.label === 'width');
      expect(width).toBeDefined();
      expect(width?.detail).toContain('width');
    });
  });

  describe('Unknown Context', () => {
    it('should return empty suggestions for unknown variable', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('unknownVar.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should return empty suggestions
      expect(result?.suggestions).toEqual([]);
    });

    it('should return empty suggestions for no dot context', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('function update(');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should return empty suggestions
      expect(result?.suggestions).toEqual([]);
    });

    it('should return empty suggestions for partial variable name', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('me');

      // WHEN: Getting completions (no dot yet)
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should return empty suggestions
      expect(result?.suggestions).toEqual([]);
    });
  });

  describe('Context Detection Edge Cases', () => {
    it('should handle "player." as player context', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('player.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should return player methods
      const labels = result?.suggestions.map((s) => s.label);
      expect(labels).toContain('moveTo');
    });

    it('should handle code with existing content before variable', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('if (me.isClosestToBall()) { me.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should still detect "me." context
      const labels = result?.suggestions.map((s) => s.label);
      expect(labels).toContain('moveTo');
    });

    it('should handle whitespace after dot', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('me. ');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: Should still return player completions
      const labels = result?.suggestions.map((s) => s.label);
      expect(labels).toContain('moveTo');
    });
  });

  describe('Tab/Enter Selection', () => {
    it('should have correct insertText for kick method with optional params', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('me.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: kick should have snippet with optional parameters
      const kick = result?.suggestions.find((s) => s.label === 'kick');
      expect(kick?.insertText).toBe('kick(${1:force}, ${2:angle})');
    });

    it('should have correct insertText for isClosestToBall method', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('me.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: isClosestToBall should insert without parameters
      const isClosestToBall = result?.suggestions.find((s) => s.label === 'isClosestToBall');
      expect(isClosestToBall?.insertText).toBe('isClosestToBall()');
    });

    it('should have property insertText without parentheses', () => {
      // GIVEN: Registered provider
      const { monaco } = createMockMonaco();
      registerGameApiCompletionProvider(monaco as unknown as typeof import('monaco-editor'));
      const provider = monaco.getRegisteredProvider();

      const { model, position } = createMockModelAndPosition('ball.');

      // WHEN: Getting completions
      const result = provider?.provideCompletionItems(model, position);

      // THEN: position property should insert just the property name
      const positionProp = result?.suggestions.find((s) => s.label === 'position');
      expect(positionProp?.insertText).toBe('position');
    });
  });
});
