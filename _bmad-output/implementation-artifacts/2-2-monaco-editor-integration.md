# Story 2.2: Monaco Editor Integration

Status: review

## Story

As a user,
I want to write JavaScript code in a professional editor,
So that I have a familiar coding experience.

## Acceptance Criteria

1. **Given** I open an AI file, **When** the editor loads, **Then** I see a Monaco editor with the file content, **And** JavaScript syntax is highlighted with proper colors, **And** line numbers are displayed, **And** the editor supports standard shortcuts (Cmd+Z, Cmd+C, etc.).

2. **Given** I am typing code, **When** I write JavaScript keywords and syntax, **Then** they are highlighted appropriately (keywords, strings, comments, etc.).

## Tasks / Subtasks

### Backend Tasks

- [x] Task 1: Script CRUD API - ALREADY COMPLETE from Story 1.4 and 2.1

### Frontend Tasks (React)

- [x] Task 2: Create MonacoEditor Component (AC: #1, #2)
  - [x] Create `src/components/editor/MonacoEditor.tsx`
  - [x] Import `@monaco-editor/react` (already in package.json)
  - [x] Configure Monaco for JavaScript language
  - [x] Set VSCode Dark theme (`vs-dark`)
  - [x] Enable line numbers, minimap (optional), word wrap
  - [x] Add `data-testid="monaco-editor"` to container

- [x] Task 3: Integrate Monaco into ScriptsPanel (AC: #1)
  - [x] Replace `<pre style={styles.codePreview}>` placeholder with `<MonacoEditor />`
  - [x] Pass `activeScript.code` as initial value
  - [x] Pass `onChange` handler to update store
  - [x] Handle loading state while Monaco initializes
  - [x] Add `data-testid="editor-container"` to wrapper

- [x] Task 4: Wire Editor to Store (AC: #1)
  - [x] Connect `onChange` to `updateScript(activeScriptId, newCode)`
  - [x] Ensure `hasUnsavedChanges` flag is set when code changes
  - [x] Handle editor focus/blur for unsaved indicator

- [x] Task 5: Editor Styling & Theme (AC: #2)
  - [x] Match VSCode Dark theme colors from UX spec (`#1e1e1e` background)
  - [x] Configure syntax highlighting colors
  - [x] Set appropriate font (Monaco, Menlo, Consolas)
  - [x] Set font size (12-14px per UX spec)

- [x] Task 6: Keyboard Shortcuts (AC: #1)
  - [x] Verify standard Monaco shortcuts work (Cmd+Z, Cmd+C, Cmd+V, Cmd+A)
  - [x] Add key binding for Cmd+S (will be used in Story 2.3)
  - [x] Ensure no conflicts with browser shortcuts

- [x] Task 7: Responsive Editor Height (AC: #1)
  - [x] Editor fills available space in ScriptsPanel
  - [x] Handle window resize
  - [x] Ensure no vertical scroll issues

### Testing Tasks

- [x] Task 8: Unit Tests for MonacoEditor Component
  - [x] Test Monaco loads with provided code
  - [x] Test onChange callback is called on edit
  - [x] Test theme is applied correctly

- [x] Task 9: E2E Tests for Monaco Integration (AC: #1, #2)
  - [x] Test: Monaco editor visible when file selected
  - [x] Test: Code content displayed in editor
  - [x] Test: Syntax highlighting visible (keywords colored)
  - [x] Test: Line numbers displayed
  - [x] Test: Standard keyboard shortcuts work (Cmd+Z for undo)

## Dev Notes

### What Already Exists

**Package.json:**
```json
"@monaco-editor/react": "^4.6.0"
```

**ScriptsPanel.tsx (lines 125-145):**
- Currently has placeholder `<pre>` showing code
- Shows "Monaco Editor will be integrated here" note
- Already has VSCode-like styling

**editorStore.ts:**
- `updateScript(id, code)` - Updates code in store and sets hasUnsavedChanges
- `markUnsaved()` / `markSaved()` - Modification state tracking
- `activeScriptId` - Currently selected script ID

### Monaco Editor React Usage

```typescript
import Editor from '@monaco-editor/react';

<Editor
  height="100%"
  defaultLanguage="javascript"
  theme="vs-dark"
  value={code}
  onChange={(value) => onCodeChange(value ?? '')}
  options={{
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
  }}
/>
```

### Architecture Compliance

**CRITICAL: All code, comments, variable names MUST be in English.**

**Frontend Patterns:**
- State: Zustand store with actions
- Styling: Inline styles object for wrapper, Monaco handles its own theming
- TypeScript: Strict mode enabled
- Components: Functional components with hooks

**File Locations:**
- New component: `src/components/editor/MonacoEditor.tsx`
- Update: `src/components/editor/ScriptsPanel.tsx`
- Store: `src/stores/editorStore.ts` (already has needed actions)

### UX Requirements (from UX Spec)

**Theme:**
- Background: `#1e1e1e` (VSCode Dark)
- Text: `#d4d4d4`
- Use `vs-dark` Monaco theme (built-in)

**Typography:**
- Font: Monaco, Menlo, Ubuntu Mono, Consolas (monospace)
- Size: 14px base (matches VSCode default)
- Line height: 1.5

**Editor Options:**
- Line numbers: ON
- Minimap: OFF (save space for MVP)
- Word wrap: ON
- Automatic layout: ON (handles resize)

### Test Selectors (MANDATORY)

| Selector | Element |
|----------|---------|
| `[data-testid="monaco-editor"]` | Monaco editor container (ADD) |
| `[data-testid="editor-container"]` | Wrapper div (ADD) |
| `[data-testid="editor-loading"]` | Loading state while Monaco loads (ADD) |
| `.monaco-editor` | Monaco's own class (for E2E assertions) |

### Test Considerations (from Test Design)

**Monaco requires special Playwright handling:**
```typescript
// Wait for Monaco to load
await page.waitForSelector('.monaco-editor');

// Type in editor (use keyboard, not fill)
await page.keyboard.type('me.moveTo(ball.position);');

// Monaco creates its own DOM structure - use .monaco-editor selector
```

**E2E Test File:** `tests/e2e/workspace.spec.ts`

### Risk Mitigation

**R2-001: Monaco editor fails to load (Risk Score: 6)**
- Implement loading state with fallback message
- Monaco lazy loads by default - show "Loading editor..." while it initializes
- Consider fallback textarea for critical failure (optional, not for MVP)

### Performance Notes

- Monaco is ~2MB, loaded asynchronously
- Use `@monaco-editor/react`'s built-in lazy loading
- `automaticLayout: true` handles resize without manual listeners

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Monaco Editor Integration]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design System Foundation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Monaco Editor]
- [Source: _bmad-output/planning-artifacts/test-design-epic-2.md#Story 2.2]
- [Source: src/components/editor/ScriptsPanel.tsx#lines 125-145]
- [Source: src/stores/editorStore.ts#updateScript]
- [Source: package.json#@monaco-editor/react]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 147 unit tests passing
- Monaco Editor component created with full TypeScript support
- Integrated with Zustand store for state management

### Completion Notes List

1. Created MonacoEditor component with vs-dark theme, JavaScript syntax highlighting, and line numbers
2. Integrated Monaco into ScriptsPanel, replacing placeholder `<pre>` element
3. Wired editor onChange to store's updateScript action - hasUnsavedChanges flag set automatically
4. Configured editor options: fontSize 14px, Monaco/Menlo/Consolas font family, word wrap, automatic layout
5. Added Cmd+S keybinding support (handler passed via onSave prop, ready for Story 2.3)
6. Responsive height achieved via flex layout and automaticLayout: true
7. Unit tests cover: rendering, configuration, value passing, theme, onChange handling, onSave keybinding
8. E2E tests cover: Monaco visibility, code content display, line numbers, syntax highlighting, Cmd+Z undo

### File List

**Files created:**
- src/components/editor/MonacoEditor.tsx
- tests/unit/components/monaco-editor.test.tsx

**Files modified:**
- src/components/editor/ScriptsPanel.tsx (replaced placeholder with MonacoEditor)
- src/components/editor/index.ts (added MonacoEditor export)
- tests/e2e/workspace.spec.ts (added Monaco E2E tests)

## Change Log

- 2026-02-01: Story 2.2 implementation complete - Monaco Editor integrated with full AC coverage
