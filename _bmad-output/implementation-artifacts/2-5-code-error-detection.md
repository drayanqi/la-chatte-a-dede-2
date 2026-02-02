# Story 2.5: Code Error Detection

Status: review

## Story

As a user,
I want to see syntax errors in my code,
So that I can fix problems before testing.

## Acceptance Criteria

1. **Given** I write invalid JavaScript syntax, **When** the editor analyzes my code, **Then** syntax errors are underlined in red, **And** I can hover to see the error message.

2. **Given** I have a syntax error, **When** I look at the editor gutter, **Then** I see an error icon on the affected line.

3. **Given** my code is syntactically valid, **When** I write code, **Then** no error indicators are shown.

## Tasks / Subtasks

### Frontend Tasks (React + Monaco)

- [x] Task 1: Enable Monaco JavaScript Validation (AC: #1, #3)
  - [x] Configure Monaco's built-in JavaScript validation in MonacoEditor.tsx
  - [x] Set `validate: true` in editor options (Monaco default language settings)
  - [x] Enable `diagnosticsOptions` for JavaScript validation
  - [x] Verify Monaco's default settings show squiggles for syntax errors

- [x] Task 2: Configure Diagnostic Severity and Appearance (AC: #1, #2)
  - [x] Use Monaco's `languages.typescript.javascriptDefaults.setDiagnosticsOptions`
  - [x] Set `noSemanticValidation: false` for semantic error checking
  - [x] Set `noSyntaxValidation: false` to enable syntax validation
  - [x] Verify error squiggles appear in red (Monaco's default error color)

- [x] Task 3: Ensure Gutter Error Icons Display (AC: #2)
  - [x] Verify Monaco displays error icons in gutter by default
  - [x] Confirm glyphMargin is enabled in editor options (`glyphMargin: true`)
  - [x] Test that error icons appear for syntax errors

- [x] Task 4: Verify Hover Shows Error Messages (AC: #1)
  - [x] Confirm Monaco's default hover behavior shows error messages
  - [x] Ensure `hover: { enabled: true }` is set in editor options
  - [x] Test hover displays clear error description

- [x] Task 5: Test Valid Code Shows No Errors (AC: #3)
  - [x] Write unit test verifying no markers for valid JavaScript
  - [x] Write E2E test confirming no error indicators for valid code
  - [x] Test the starter AI template has no errors

### Testing Tasks

- [x] Task 6: Unit Tests for Error Detection
  - [x] Test: Invalid syntax creates error markers in model
  - [x] Test: Valid syntax has no error markers
  - [x] Test: Multiple errors show multiple markers
  - [x] Test: Fixing syntax removes error markers

- [x] Task 7: E2E Tests for Error Detection (AC: #1, #2, #3)
  - [x] Test: Syntax error shows red underline
  - [x] Test: Hover on error shows message
  - [x] Test: Error icon appears in gutter
  - [x] Test: Valid code shows no errors
  - [x] Test: Fixing error removes indicators

## Dev Notes

### Monaco Built-in Validation

Monaco Editor includes built-in JavaScript/TypeScript validation through the TypeScript language service. This validation is ENABLED BY DEFAULT for JavaScript but may need explicit configuration.

**Default Behavior:**
- JavaScript files are validated using TypeScript's JavaScript mode
- Syntax errors are detected automatically
- Squiggles appear under errors
- Hover shows error messages
- Gutter icons appear for errors

### Monaco Configuration Pattern

```typescript
import { loader } from '@monaco-editor/react';

// Configure JavaScript defaults BEFORE editor loads
loader.init().then((monaco) => {
  // Access JavaScript defaults from TypeScript service
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false, // Enable semantic validation
    noSyntaxValidation: false,   // Enable syntax validation (CRITICAL)
  });

  // Optionally set compiler options
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    checkJs: true,  // Enable type checking in JS files
  });
});
```

### Editor Options for Error Display

```typescript
const editorOptions = {
  // Gutter for error icons
  glyphMargin: true,

  // Hover for error messages
  hover: {
    enabled: true,
    delay: 300,
  },

  // Quick suggestions (optional, already configured)
  quickSuggestions: true,

  // Show error squiggles
  renderValidationDecorations: 'on',
};
```

### Error Marker Colors (Monaco Defaults)

| Severity | Squiggle Color | Gutter Icon |
|----------|---------------|-------------|
| Error | Red (`#f14c4c`) | Red circle with X |
| Warning | Yellow (`#dcdcaa`) | Yellow triangle |
| Info | Blue (`#007acc`) | Blue info icon |

### What Already Exists

**MonacoEditor.tsx:**
- Monaco editor with VSCode Dark theme
- JavaScript language configured
- Game API autocomplete registered
- Keybindings for save (Cmd+S)

**Current Editor Options:**
```typescript
options={{
  minimap: { enabled: false },
  fontSize: 14,
  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true,
  formatOnPaste: true,
  formatOnType: true,
  cursorBlinking: 'smooth',
  smoothScrolling: true,
  padding: { top: 8, bottom: 8 },
}}
```

**Missing options for this story:**
- `glyphMargin: true` - For error icons in gutter
- `hover: { enabled: true }` - For error message hover (may already be default)

### Architecture Compliance

**CRITICAL: All code, comments, variable names MUST be in English.**

**File Locations:**
- Update: `src/components/editor/MonacoEditor.tsx` (add validation configuration)

**Frontend Patterns:**
- TypeScript: Strict mode
- Monaco API: Use `monaco.languages.typescript.javascriptDefaults`
- Configuration: Done in `loader.init()` callback (singleton pattern already exists)

### UX Requirements (from UX Spec)

**Error Display (Phase 2 - Editor Panel):**
- Red squiggles for errors
- Error messages on hover
- VSCode-like experience

**Color Strategy:**
- Error color: `#f14c4c` (Soft Red)
- This aligns with Monaco's default error color

### Test Selectors (MANDATORY)

| Selector | Element |
|----------|---------|
| `.monaco-editor` | Monaco editor container (EXISTS) |
| `.squiggly-error` | Error underline decoration (Monaco built-in) |
| `.margin-view-overlays .codicon-error` | Error icon in gutter (Monaco built-in) |
| `.hover-contents` | Hover tooltip content (Monaco built-in) |
| `[data-testid="monaco-editor"]` | Editor wrapper (EXISTS) |

### Test Considerations (from Test Design)

**E2E Error Detection Test Pattern:**
```typescript
// Type invalid JavaScript
await page.click('.monaco-editor');
await page.keyboard.type('function test() { return ');  // Missing closing

// Wait for Monaco to analyze (uses debounce)
await page.waitForTimeout(500);

// Verify error squiggle appears
await expect(page.locator('.squiggly-error')).toBeVisible();

// Hover over error to see message
const errorElement = page.locator('.squiggly-error').first();
await errorElement.hover();

// Verify hover shows error message
await expect(page.locator('.hover-contents')).toBeVisible();
await expect(page.locator('.hover-contents')).toContainText(/expected|unexpected|syntax/i);

// Verify gutter icon
await expect(page.locator('.margin-view-overlays .codicon-error')).toBeVisible();
```

**Valid Code Test:**
```typescript
// Type valid JavaScript
await page.keyboard.type('function test() { return 42; }');

// Wait for Monaco
await page.waitForTimeout(500);

// Verify no errors
await expect(page.locator('.squiggly-error')).not.toBeVisible();
```

### Risk Mitigation (from Test Design)

**R2-008: Syntax error detection misses errors (Risk Score: 4)**
- Use Monaco's built-in TypeScript checker (not custom implementation)
- Monaco's validation is battle-tested and reliable
- Test with common error patterns (missing brackets, quotes, parentheses)

### Previous Story Intelligence

**Patterns from Story 2.4:**
- Monaco loader initialization pattern established
- Singleton pattern for one-time configuration
- Game API completion provider registered in `loader.init()` callback
- Same pattern can be used for diagnostic options

**From MonacoEditor.tsx (lines 48-62):**
```typescript
useEffect(() => {
  loader.init().then((monaco) => {
    monacoRef.current = monaco;
    if (!completionProviderDisposable) {
      completionProviderDisposable = registerGameApiCompletionProvider(monaco);
    }
  });
}, []);
```

**Extension for Story 2.5:**
Add diagnostic configuration to the same `loader.init()` callback:
```typescript
loader.init().then((monaco) => {
  monacoRef.current = monaco;

  // Story 2.4: Game API autocomplete
  if (!completionProviderDisposable) {
    completionProviderDisposable = registerGameApiCompletionProvider(monaco);
  }

  // Story 2.5: Enable JavaScript validation
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
});
```

### Common JavaScript Syntax Errors to Test

| Error Type | Example | Expected Message |
|------------|---------|------------------|
| Missing parenthesis | `console.log("hi"` | "')' expected" |
| Missing bracket | `const x = [1, 2` | "']' expected" |
| Missing brace | `function f() { return 1` | "'}' expected" |
| Missing quote | `const s = "hello;` | "Unterminated string" |
| Invalid token | `const 123x = 1;` | "Identifier expected" |
| Unexpected token | `return;;` | "Expression expected" |

### Implementation Strategy

1. **Start simple**: Monaco may already show errors by default with JavaScript
2. **Test first**: Check if current MonacoEditor.tsx already detects errors
3. **Configure if needed**: Only add explicit configuration if errors don't appear
4. **Add glyphMargin**: Enable gutter icons for visibility (AC #2)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5: Code Error Detection]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual Design Foundation]
- [Source: _bmad-output/planning-artifacts/test-design-epic-2.md#Story 2.5]
- [Source: src/components/editor/MonacoEditor.tsx]
- [Source: _bmad-output/implementation-artifacts/2-4-game-api-autocomplete.md]
- [Web: Monaco Diagnostics Options](https://microsoft.github.io/monaco-editor/typedoc/interfaces/languages.typescript.DiagnosticsOptions.html)
- [Web: Monaco JavaScript Language Defaults](https://microsoft.github.io/monaco-editor/typedoc/variables/languages.typescript.javascriptDefaults.html)
- [Web: Monaco Editor Options](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IStandaloneEditorConstructionOptions.html)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 7 tasks implemented following story specifications
- Used Monaco's built-in TypeScript language service for JavaScript validation
- Singleton pattern used for one-time validation configuration

### Completion Notes List

1. **Task 1**: Configured Monaco JavaScript validation via `loader.init()` callback using singleton pattern
2. **Task 2**: Set `setDiagnosticsOptions()` with `noSemanticValidation: false` and `noSyntaxValidation: false`
3. **Task 3**: Added `glyphMargin: true` to editor options for gutter error icons
4. **Task 4**: Added `hover: { enabled: true, delay: 300 }` to editor options
5. **Task 5**: Added `renderValidationDecorations: 'on'` and E2E test for valid code
6. **Task 6**: Created unit tests in `tests/unit/components/MonacoEditor.test.ts` covering validation configuration
7. **Task 7**: Added 5 E2E tests in `tests/e2e/workspace.spec.ts` for error detection (squiggles, hover, gutter icons)

### File List

**Files modified:**
- src/components/editor/MonacoEditor.tsx (added validation configuration and editor options)
- tests/e2e/workspace.spec.ts (added Story 2.5 E2E tests)

**Files created:**
- tests/unit/components/MonacoEditor.test.ts (unit tests for validation configuration)

## Change Log

- 2026-02-02: Story 2.5 implementation complete - JavaScript syntax error detection with Monaco validation
