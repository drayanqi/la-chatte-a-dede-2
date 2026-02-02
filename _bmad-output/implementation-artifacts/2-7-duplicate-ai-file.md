# Story 2.7: Duplicate AI File

Status: review

## Story

As a user,
I want to duplicate an AI file,
So that I can create variations of my strategies for testing.

## Acceptance Criteria

1. **Given** I have an AI file, **When** I right-click and select "Duplicate", **Then** a new file is created with name "Copy of [original name]", **And** the new file contains the same code as the original, **And** the new file is opened in the editor.

2. **Given** I duplicate a file, **When** the operation completes, **Then** both files appear in my file list independently, **And** editing one does not affect the other.

## Tasks / Subtasks

### Frontend Tasks (React + Zustand)

- [x] Task 1: Add Duplicate Action to Context Menu (AC: #1)
  - [x] Add "Duplicate" option to existing context menu in ScriptsPanel.tsx
  - [x] Position below "Rename" option for logical grouping
  - [x] Add appropriate handler function

- [x] Task 2: Add duplicateScript Action to Editor Store (AC: #1, #2)
  - [x] Add `duplicateScript(id: string): Promise<string | null>` action
  - [x] Add `isDuplicating` state to track duplicate in progress
  - [x] Generate name: "Copy of [original name]" (handle existing "Copy of" prefix)
  - [x] Call `POST /api/scripts` with duplicated data
  - [x] Add new script to local scripts Map on success
  - [x] Return new script ID for auto-open

- [x] Task 3: Generate Unique Duplicate Name (AC: #1)
  - [x] Create `generateDuplicateName(originalName: string, existingNames: string[])` utility
  - [x] Pattern: "Copy of Original.js" -> "Copy of Original (2).js" -> "Copy of Original (3).js"
  - [x] Handle edge case: Original name already starts with "Copy of "
  - [x] Ensure .js extension is preserved

- [x] Task 4: Auto-Open Duplicated File (AC: #1)
  - [x] After successful duplication, call `openScript(newScriptId)`
  - [x] Duplicated file should be selected in file list
  - [x] Editor should show duplicated file content

- [x] Task 5: Update UI After Successful Duplicate (AC: #2)
  - [x] Script list updates immediately with new file
  - [x] New file appears in correct sort position (by last modified = top)
  - [x] Close context menu after duplicate action

### Testing Tasks

- [x] Task 6: Unit Tests for Duplicate Logic
  - [x] Test: duplicateScript creates new script with correct name
  - [x] Test: duplicateScript calls API with correct payload (name, code, language)
  - [x] Test: generateDuplicateName returns "Copy of X" for first duplicate
  - [x] Test: generateDuplicateName handles existing "Copy of" names
  - [x] Test: duplicateScript opens new script after creation
  - [x] Test: Original script remains unchanged after duplication
  - [x] Test: isDuplicating state is set during operation

- [x] Task 7: E2E Tests for Duplicate Feature (AC: #1, #2)
  - [x] Test: Right-click shows context menu with "Duplicate" option
  - [x] Test: Clicking "Duplicate" creates new file with "Copy of" prefix
  - [x] Test: Duplicated file contains same code as original
  - [x] Test: Duplicated file is opened in editor
  - [x] Test: Both files appear independently in list
  - [x] Test: Editing duplicate does not affect original

## Dev Notes

### Existing Architecture (from Story 2.6)

**ScriptsPanel.tsx** now has a context menu with right-click support:
- `contextMenuScriptId` state tracks which script the menu is for
- `contextMenuPosition` tracks x/y position for fixed positioning
- `handleContextMenu` handler opens menu on right-click
- "Rename" option already exists

**Current Context Menu Structure:**
```tsx
{contextMenuScriptId && (
  <div
    data-testid="script-context-menu"
    style={{
      ...styles.contextMenu,
      left: contextMenuPosition.x,
      top: contextMenuPosition.y,
    }}
    onClick={(e) => e.stopPropagation()}
  >
    <button
      data-testid="rename-option"
      style={styles.contextMenuItem}
      onClick={() => startRename(contextMenuScriptId)}
    >
      Rename
    </button>
  </div>
)}
```

**editorStore.ts:**
- `createScript(name, code)` - Creates new script via `POST /api/scripts`
- `renameScript(id, newName)` - Renames via `PUT /api/scripts/{id}`
- `isCreatingScript` state - Tracks creation in progress
- `isRenaming` state - Tracks rename in progress
- API URL: `${API_URL}/scripts`

**API Endpoint (ScriptController.php):**
```php
public function store(Request $request): JsonResponse
{
    $validated = $request->validate([
        'name' => 'required|string|max:255',
        'code' => 'required|string',
        'language' => 'nullable|string|max:50',
    ]);
    // Creates script for authenticated user
    // Returns: { id, name, code, language, updated_at }
}
```

### Implementation Strategy

**Duplicate Flow:**
1. User right-clicks script item → context menu appears
2. User clicks "Duplicate" option
3. Frontend generates unique name: "Copy of [originalName].js"
4. Frontend calls `duplicateScript(scriptId)`
5. Store fetches original script data
6. Store calls `POST /api/scripts` with: name, code (copied), language
7. On success: add to scripts Map, auto-open new script
8. Context menu closes

**Name Generation Logic:**
```typescript
function generateDuplicateName(originalName: string, existingNames: string[]): string {
  // Remove .js extension for manipulation
  const baseName = originalName.replace(/\.js$/i, '');

  // Start with "Copy of X"
  let newName = `Copy of ${baseName}`;
  let counter = 2;

  // If already exists, add (2), (3), etc.
  while (existingNames.includes(`${newName}.js`)) {
    newName = `Copy of ${baseName} (${counter})`;
    counter++;
  }

  return `${newName}.js`;
}
```

### Validation Rules

No special validation needed - we're creating a new script with valid data from an existing script. The backend validates:
- name: required, string, max:255
- code: required, string
- language: nullable, string, max:50

### Architecture Compliance

**CRITICAL: All code, comments, variable names MUST be in English.**

**File Locations:**
- Update: `src/components/editor/ScriptsPanel.tsx` (add Duplicate menu option)
- Update: `src/stores/editorStore.ts` (add duplicateScript action, isDuplicating state)

**Frontend Patterns:**
- TypeScript: Strict mode
- React: Functional components with hooks
- Styling: Inline styles object (following existing pattern)
- State: Zustand for global state
- Testing: data-testid attributes on all interactive elements

**Test Selectors (MANDATORY):**

| Selector | Element |
|----------|---------|
| `[data-testid="script-item-${id}"]` | Script list item (EXISTS) |
| `[data-testid="script-context-menu"]` | Context menu container (EXISTS) |
| `[data-testid="rename-option"]` | Rename menu option (EXISTS) |
| `[data-testid="duplicate-option"]` | Duplicate menu option (NEW) |

### UX Requirements (from UX Spec)

**Context Menu Pattern:**
- VSCode-style context menu
- Keyboard accessible (eventually)
- Close on click outside

**Feedback:**
- Brief loading state while duplicating (optional)
- Auto-open confirms success

### Previous Story Intelligence

**From Story 2.1 (Create and List):**
- `createScript(name, code)` action pattern for POST /api/scripts
- `openScript(id)` action for auto-opening
- `addScript(script)` for adding to Map

**From Story 2.6 (Rename):**
- Context menu implementation exists
- `contextMenuScriptId` and `contextMenuPosition` state
- `handleContextMenu` handler
- `styles.contextMenu` and `styles.contextMenuItem` styles defined

### Project Structure Notes

**Existing src/components/editor:**
- ScriptsPanel.tsx (context menu exists)
- MonacoEditor.tsx (editor component)
- SaveIndicator.tsx (save status display)
- index.ts (exports)

**No new components required** - only need to:
1. Add "Duplicate" button to existing context menu
2. Add `duplicateScript` action to editorStore
3. Add `isDuplicating` state

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7: Duplicate AI File]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual Design Foundation]
- [Source: lachatadede-api/app/Http/Controllers/ScriptController.php#store]
- [Source: src/components/editor/ScriptsPanel.tsx]
- [Source: src/stores/editorStore.ts]
- [Source: _bmad-output/implementation-artifacts/2-6-rename-ai-file.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No significant debugging required.

### Completion Notes List

- Added `generateDuplicateName` utility function for unique name generation with pattern: "Copy of X" -> "Copy of X (2)" -> etc.
- Added `isDuplicating` state to EditorState interface and initialState
- Implemented `duplicateScript(id: string): Promise<string | null>` action in editorStore
- Duplicated scripts are placed at top of list (most recently modified position)
- Auto-opens duplicated script in editor after creation
- Added "Duplicate" option to existing context menu in ScriptsPanel.tsx
- Added disabled state styling for duplicate button while operation in progress
- Uses existing `POST /api/scripts` endpoint - no backend changes needed
- Added comprehensive unit tests (13 new tests) for duplicateScript store action
- Added comprehensive E2E tests (7 new tests) for duplicate UI flow

### File List

- src/stores/editorStore.ts (modified)
- src/components/editor/ScriptsPanel.tsx (modified)
- tests/unit/stores/editor-store.test.ts (modified)
- tests/e2e/workspace.spec.ts (modified)

## Change Log

- 2026-02-02: Implemented duplicate AI file feature (Story 2.7)

