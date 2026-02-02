# Story 2.4: Game API Autocomplete

Status: review

## Story

As a user,
I want autocomplete suggestions for the game API,
So that I can discover available functions without leaving the editor.

## Acceptance Criteria

1. **Given** I am typing in the editor, **When** I type "me.", **Then** I see autocomplete suggestions for player methods (moveTo, kick, isClosestToBall, etc.), **And** each suggestion shows a description.

2. **Given** I am typing "ball.", **When** the autocomplete appears, **Then** I see ball properties (position, velocity), **And** I see ball methods if any.

3. **Given** I select an autocomplete suggestion, **When** I press Tab or Enter, **Then** the suggestion is inserted into my code.

## Tasks / Subtasks

### Frontend Tasks (React + Monaco)

- [x] Task 1: Define Game API Type Definitions (AC: #1, #2)
  - [x] Create `src/lib/gameApiTypes.ts` with TypeScript interfaces for all game objects
  - [x] Define `Player` interface: moveTo(x, y), kick(force?, angle?), isClosestToBall(), position, velocity
  - [x] Define `Ball` interface: position, velocity
  - [x] Define `Goal` interface: position, width
  - [x] Define `Teammates` and `Opponents` array types
  - [x] Include JSDoc comments for each method/property (will become autocomplete descriptions)

- [x] Task 2: Create Monaco Completion Provider (AC: #1, #2, #3)
  - [x] Create `src/lib/monacoGameApiProvider.ts`
  - [x] Use `monaco.languages.registerCompletionItemProvider('javascript', provider)`
  - [x] Implement `provideCompletionItems(model, position)` function
  - [x] Parse current line to detect context: "me.", "ball.", "goal.", etc.
  - [x] Return appropriate `CompletionItem[]` based on context
  - [x] Set `CompletionItemKind.Method` for methods, `CompletionItemKind.Property` for properties
  - [x] Include `documentation` field with method descriptions
  - [x] Include `insertText` for method signatures with placeholders

- [x] Task 3: Generate CompletionItems from Type Definitions (AC: #1, #2)
  - [x] Map Player methods to CompletionItems with kind=Method
  - [x] Map Player properties to CompletionItems with kind=Property
  - [x] Map Ball properties/methods to CompletionItems
  - [x] Map Goal properties to CompletionItems
  - [x] Include `detail` (type signature) and `documentation` (description) for each

- [x] Task 4: Integrate Provider with MonacoEditor Component (AC: #1, #2, #3)
  - [x] Import and call `registerGameApiCompletionProvider()` in MonacoEditor's `onMount`
  - [x] Ensure provider is registered only once (check if already registered)
  - [x] Pass monaco instance to registration function
  - [x] Dispose provider on component unmount (return cleanup function)

- [x] Task 5: Handle Parameter Variables (AC: #1, #2)
  - [x] Detect `me`, `ball`, `teammates`, `opponents`, `goal` variable names
  - [x] Trigger autocomplete when typing any of these followed by "."
  - [x] Support teammates[0]., opponents[0]. for array access
  - [ ] Support custom variable names assigned from parameters (stretch goal)

- [x] Task 6: Add Autocomplete Trigger Characters (AC: #1)
  - [x] Configure Monaco to trigger autocomplete on "." character
  - [x] Set `triggerCharacters: ['.']` in completion provider
  - [x] Ensure Ctrl+Space also triggers autocomplete manually

### Testing Tasks

- [x] Task 7: Unit Tests for Completion Provider
  - [x] Test: "me." returns player methods
  - [x] Test: "ball." returns ball properties
  - [x] Test: "goal." returns goal properties
  - [x] Test: Tab/Enter inserts suggestion text
  - [x] Test: Provider returns empty array for unknown context

- [x] Task 8: E2E Tests for Autocomplete (AC: #1, #2, #3)
  - [x] Test: Type "me." shows autocomplete popup
  - [x] Test: Autocomplete contains "moveTo" method
  - [x] Test: Autocomplete contains "isClosestToBall" method
  - [x] Test: "ball." shows position and velocity
  - [x] Test: Select suggestion with Tab inserts code
  - [x] Test: Suggestions include descriptions

## Dev Notes

### Game API Reference (from Backend Architecture)

**Player Object (`me`, `teammates[i]`, `opponents[i]`):**
```typescript
interface Player {
  // Properties (readonly)
  position: { x: number; y: number };
  velocity: { x: number; y: number };

  // Methods
  moveTo(x: number, y: number): void;
  kick(force?: number, angle?: number): void;
  isClosestToBall(): boolean;
}
```

**Ball Object:**
```typescript
interface Ball {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}
```

**Goal Object:**
```typescript
interface Goal {
  position: { x: number; y: number };
  width: number;
}
```

**Update Function Signature:**
```typescript
function update(
  me: Player,
  ball: Ball,
  teammates: Player[],
  opponents: Player[],
  goal: Goal
): void;
```

### Monaco CompletionItemProvider Pattern

```typescript
import * as monaco from 'monaco-editor';

export function registerGameApiCompletionProvider(monacoInstance: typeof monaco) {
  return monacoInstance.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['.'],

    provideCompletionItems: (model, position) => {
      // Get text before cursor
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Detect context (e.g., "me.", "ball.")
      const match = textUntilPosition.match(/(\w+)\.\s*$/);
      if (!match) return { suggestions: [] };

      const context = match[1];
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn,
      };

      // Return suggestions based on context
      if (context === 'me' || context === 'player') {
        return { suggestions: getPlayerSuggestions(range) };
      }
      if (context === 'ball') {
        return { suggestions: getBallSuggestions(range) };
      }
      // etc.

      return { suggestions: [] };
    },
  });
}
```

### CompletionItem Structure

```typescript
const suggestion: monaco.languages.CompletionItem = {
  label: 'moveTo',
  kind: monaco.languages.CompletionItemKind.Method,
  insertText: 'moveTo(${1:x}, ${2:y})',
  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  documentation: {
    value: 'Move the player toward the specified coordinates.\n\n**Parameters:**\n- `x`: Target X position\n- `y`: Target Y position',
  },
  detail: '(method) moveTo(x: number, y: number): void',
  range: range,
};
```

### What Already Exists

**MonacoEditor.tsx:**
- Monaco editor with VSCode Dark theme
- JavaScript language already configured
- `onMount` callback available for provider registration

**editorStore.ts:**
- Script management (no changes needed for this story)

### Architecture Compliance

**CRITICAL: All code, comments, variable names MUST be in English.**

**File Locations:**
- New file: `src/lib/gameApiTypes.ts` (type definitions)
- New file: `src/lib/monacoGameApiProvider.ts` (completion provider)
- Update: `src/components/editor/MonacoEditor.tsx` (register provider)

**Frontend Patterns:**
- TypeScript: Strict mode
- Monaco API: Use official `monaco-editor` types
- Styling: N/A (autocomplete uses Monaco's built-in styling)

### UX Requirements (from UX Spec)

**Autocomplete Behavior:**
- Trigger on "." character after known objects (me, ball, goal, teammates, opponents)
- Trigger manually with Ctrl+Space
- Tab or Enter to accept suggestion
- Escape to dismiss
- Arrow keys to navigate

**Autocomplete Appearance (Monaco built-in):**
- VSCode-style popup
- Icons for methods vs properties
- Description in side panel

### Test Selectors (MANDATORY)

| Selector | Element |
|----------|---------|
| `.monaco-editor` | Monaco editor container (EXISTS) |
| `.monaco-list-row` | Autocomplete suggestion row (Monaco built-in) |
| `.suggest-widget` | Autocomplete popup container (Monaco built-in) |
| `[data-testid="monaco-editor"]` | Editor wrapper (EXISTS) |

### Test Considerations (from Test Design)

**E2E Autocomplete Test Pattern:**
```typescript
// Type in Monaco editor
await page.click('.monaco-editor');
await page.keyboard.type('me.');

// Wait for autocomplete popup
await page.waitForSelector('.suggest-widget', { state: 'visible' });

// Verify suggestions exist
const suggestions = await page.locator('.monaco-list-row').allTextContents();
expect(suggestions.join('')).toMatch(/moveTo|kick|isClosestToBall/);

// Select first suggestion with Tab
await page.keyboard.press('Tab');

// Verify text was inserted
const editorContent = await page.evaluate(() => {
  // Access Monaco model directly
  return (window as any).monaco?.editor?.getModels()[0]?.getValue();
});
expect(editorContent).toContain('moveTo');
```

**Triggering Autocomplete Manually:**
```typescript
// Ctrl+Space to trigger autocomplete
await page.keyboard.press('Control+Space');
await page.waitForSelector('.suggest-widget', { state: 'visible' });
```

### Risk Mitigation (from Test Design)

**R2-003: Autocomplete suggestions incomplete (Risk Score: 4)**
- Load full game API type definitions
- Include ALL methods and properties from the architecture doc
- Test each object type has correct suggestions

### Previous Story Intelligence

**Patterns from Story 2.2 and 2.3:**
- MonacoEditor component uses `onMount` callback - use this for provider registration
- Monaco instance available via `@monaco-editor/react` loader
- Editor already configured for JavaScript

**Monaco keybindings work (from 2.3):**
- Custom keybindings via `editor.addCommand()` work correctly
- Same pattern can be used if needed for autocomplete shortcuts

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4: Game API Autocomplete]
- [Source: _bmad-output/planning-artifacts/backend-architecture.md]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#API Discoverability]
- [Source: _bmad-output/planning-artifacts/test-design-epic-2.md#Story 2.4]
- [Source: src/components/editor/MonacoEditor.tsx]
- [Web: Monaco Editor registerCompletionItemProvider](https://microsoft.github.io/monaco-editor/typedoc/functions/languages.registerCompletionItemProvider.html)
- [Web: Monaco CompletionItem Interface](https://microsoft.github.io/monaco-editor/typedoc/interfaces/languages.CompletionItem.html)
- [Web: Custom IntelliSense with Monaco Editor](https://mono.software/2017/04/11/custom-intellisense-with-monaco-editor/)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 8 tasks implemented following story specifications
- Completion provider uses Monaco's registerCompletionItemProvider API
- Singleton pattern prevents duplicate provider registration

### Completion Notes List

1. **Task 1**: Created `src/lib/gameApiTypes.ts` with Player, Ball, Goal, Vector2D interfaces with JSDoc comments
2. **Task 2**: Created `src/lib/monacoGameApiProvider.ts` with full completion provider implementation
3. **Task 3**: CompletionItems generated with proper Method/Property kinds, documentation, and insertText
4. **Task 4**: Integrated provider in MonacoEditor.tsx using loader.init() and singleton pattern
5. **Task 5**: Context detection handles me, ball, goal, teammates, opponents, player variables with array access support
6. **Task 6**: Trigger character "." configured in provider, Ctrl+Space works via Monaco defaults
7. **Task 7**: Added 25+ unit tests in `tests/unit/lib/monacoGameApiProvider.test.ts`
8. **Task 8**: Added 8 E2E tests in `tests/e2e/workspace.spec.ts` for autocomplete functionality

### File List

**Files created:**
- src/lib/gameApiTypes.ts
- src/lib/monacoGameApiProvider.ts
- src/lib/index.ts
- tests/unit/lib/monacoGameApiProvider.test.ts

**Files modified:**
- src/components/editor/MonacoEditor.tsx (added completion provider registration)
- tests/e2e/workspace.spec.ts (added Story 2.4 E2E tests)

## Change Log

- 2026-02-02: Story 2.4 implementation complete - Game API autocomplete with Monaco completion provider
