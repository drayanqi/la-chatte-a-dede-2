# Story 2.6: Rename AI File

Status: review

## Story

As a user,
I want to rename my AI files,
So that I can organize them by strategy (GoalkeeperAI, AttackerAI, etc.).

## Acceptance Criteria

1. **Given** I have an AI file, **When** I right-click and select "Rename" (or double-click the name), **Then** I can edit the filename inline, **And** pressing Enter saves the new name.

2. **Given** I enter an invalid name (empty, special characters), **When** I try to save, **Then** I see a validation error.

3. **Given** I rename a file, **When** the rename completes, **Then** the file list updates immediately, **And** the editor tab shows the new name.

## Tasks / Subtasks

### Frontend Tasks (React + Zustand)

- [x] Task 1: Add Rename Action to Script Item Context Menu (AC: #1)
  - [x] Add right-click context menu to script items in ScriptsPanel.tsx
  - [x] Add "Rename" menu option that triggers edit mode
  - [x] Use shadcn/ui DropdownMenu or ContextMenu component
  - [x] Position context menu relative to clicked item

- [x] Task 2: Implement Inline Rename Mode (AC: #1)
  - [x] Add `renamingScriptId` state to track which script is being renamed
  - [x] Create inline input component for script name editing
  - [x] Auto-focus input when entering rename mode
  - [x] Select all text on focus for easy replacement
  - [x] Style input to match surrounding script item aesthetics

- [x] Task 3: Double-Click to Rename Alternative (AC: #1)
  - [x] Add double-click handler on script name element
  - [x] Double-click triggers inline edit mode (same as right-click > Rename)
  - [x] Prevent double-click from also triggering single-click open action

- [x] Task 4: Handle Rename Keyboard Interactions (AC: #1)
  - [x] Enter key confirms rename and saves to server
  - [x] Escape key cancels rename and reverts to original name
  - [x] Tab key confirms rename (like Enter)
  - [x] Click outside input also confirms rename

- [x] Task 5: Frontend Validation (AC: #2)
  - [x] Validate name is not empty (trim whitespace)
  - [x] Validate name does not contain invalid characters: `/\:*?"<>|`
  - [x] Validate name ends with `.js` extension (auto-append if missing)
  - [x] Validate name max length (255 characters)
  - [x] Show validation error tooltip/message near input
  - [x] Keep input focused on validation error to allow correction

- [x] Task 6: Add renameScript Action to Editor Store (AC: #1, #3)
  - [x] Add `renameScript(id: string, newName: string): Promise<boolean>` action
  - [x] Add `isRenaming` state to track rename in progress
  - [x] Call `PUT /api/scripts/{id}` with new name
  - [x] Update script in local state on success
  - [x] Handle error state if rename fails
  - [x] Return boolean to indicate success/failure for UI feedback

- [x] Task 7: Update UI After Successful Rename (AC: #3)
  - [x] Script list updates immediately with new name
  - [x] Editor header displays new name if renamed script is active
  - [x] Exit inline edit mode after successful save
  - [x] Show brief success feedback (optional, subtle)

### Testing Tasks

- [x] Task 8: Unit Tests for Rename Logic
  - [x] Test: renameScript updates script name in store
  - [x] Test: renameScript calls API with correct payload
  - [x] Test: Validation rejects empty names
  - [x] Test: Validation rejects names with invalid characters
  - [x] Test: Validation auto-appends .js extension
  - [x] Test: Same name as current is a no-op (no API call)

- [x] Task 9: E2E Tests for Rename Feature (AC: #1, #2, #3)
  - [x] Test: Right-click shows context menu with "Rename" option
  - [x] Test: Clicking "Rename" shows inline input
  - [x] Test: Double-click on name shows inline input
  - [x] Test: Enter key saves new name
  - [x] Test: Escape key cancels rename
  - [x] Test: Empty name shows validation error
  - [x] Test: Invalid characters show validation error
  - [x] Test: Successful rename updates file list
  - [x] Test: Successful rename updates editor header

## Dev Notes

### Existing Architecture

**ScriptsPanel.tsx (src/components/editor/ScriptsPanel.tsx):**
- Script list renders `scripts.values()` with `scriptItem` styling
- Each script item has: icon, name, language, drag handle
- Click opens script in editor (`openScript(script.id)`)
- Drag enabled for lineup assignment

**Current Script Item Structure:**
```tsx
<div
  key={script.id}
  data-testid={`script-item-${script.id}`}
  style={{...styles.scriptItem, ...(activeScriptId === script.id ? styles.scriptItemActive : {})}}
  draggable
  onDragStart={(e) => handleDragStart(e, script)}
  onClick={() => openScript(script.id)}
>
  <span style={styles.scriptIcon}>📜</span>
  <div style={styles.scriptInfo}>
    <span data-testid={`script-name-${script.id}`} style={styles.scriptName}>
      {script.name}
    </span>
    <span style={styles.scriptLang}>{script.language}</span>
  </div>
  <span style={styles.dragHandle}>⋮⋮</span>
</div>
```

**editorStore.ts (src/stores/editorStore.ts):**
- Scripts stored in `Map<string, Script>`
- Has `updateScript(id, code)` but no `renameScript`
- `saveScript(id)` sends PUT with code AND name
- API URL: `${API_URL}/scripts/{id}`

**API Endpoint (ScriptController.php):**
```php
public function update(Request $request, string $id): JsonResponse
{
    $validated = $request->validate([
        'name' => 'nullable|string|max:255',
        'code' => 'nullable|string',
        'language' => 'nullable|string|max:50',
    ]);
    $script->update(array_filter($validated));
    // Returns updated script
}
```
- Backend already supports renaming via PUT /api/scripts/{id} with `name` field
- No additional backend work needed

### Implementation Strategy

**Inline Edit Approach:**
Rather than a modal dialog, use inline editing for better UX:
1. Replace script name `<span>` with `<input>` when in rename mode
2. Input inherits same styling as name span
3. Auto-focus and select all text
4. Handle keyboard events (Enter, Escape)
5. Click outside to save (or cancel)

**State Management:**
Add to ScriptsPanel component (local state, not global store):
```tsx
const [renamingScriptId, setRenamingScriptId] = useState<string | null>(null);
const [renameValue, setRenameValue] = useState('');
const [renameError, setRenameError] = useState<string | null>(null);
```

Or add to editorStore if needed for editor header sync:
```typescript
// In EditorState
renamingScriptId: string | null;
isRenaming: boolean;
```

**Context Menu Pattern:**
Use right-click context menu for rename option:
```tsx
const handleContextMenu = (e: React.MouseEvent, script: Script) => {
  e.preventDefault();
  setContextMenuPosition({ x: e.clientX, y: e.clientY });
  setContextMenuScriptId(script.id);
};
```

Or use shadcn/ui DropdownMenu component which handles positioning automatically.

### Validation Rules

| Rule | Check | Error Message |
|------|-------|---------------|
| Empty name | `name.trim() === ''` | "Name cannot be empty" |
| Invalid chars | `/[/\\:*?"<>|]/.test(name)` | "Name contains invalid characters" |
| No extension | `!name.endsWith('.js')` | Auto-append `.js` (no error) |
| Too long | `name.length > 255` | "Name is too long (max 255 characters)" |
| Same as current | `name === script.name` | Skip API call (no error) |

### Architecture Compliance

**CRITICAL: All code, comments, variable names MUST be in English.**

**File Locations:**
- Update: `src/components/editor/ScriptsPanel.tsx` (add rename UI)
- Update: `src/stores/editorStore.ts` (add renameScript action)
- Create: `src/components/editor/ScriptNameInput.tsx` (optional, inline edit component)

**Frontend Patterns:**
- TypeScript: Strict mode
- React: Functional components with hooks
- Styling: Inline styles object (following existing pattern)
- State: Zustand for global state, React useState for local UI state
- Testing: data-testid attributes on all interactive elements

**Test Selectors (MANDATORY):**

| Selector | Element |
|----------|---------|
| `[data-testid="script-item-${id}"]` | Script list item (EXISTS) |
| `[data-testid="script-name-${id}"]` | Script name text (EXISTS) |
| `[data-testid="script-rename-input"]` | Rename input field (NEW) |
| `[data-testid="script-context-menu"]` | Context menu container (NEW) |
| `[data-testid="rename-option"]` | Rename menu option (NEW) |
| `[data-testid="rename-error"]` | Validation error message (NEW) |

### UX Requirements (from UX Spec)

**Inline Editing Pattern:**
- VSCode-style inline rename (F2 or double-click)
- Escape to cancel, Enter to confirm
- Auto-select all text on focus

**Color Tokens:**
- Input background: `#3c3c3c` (matches VSCode input)
- Input text: `#d4d4d4` (primary text)
- Input border: `#007acc` when focused (accent)
- Error border: `#f14c4c` (error color)

**Micro-interactions:**
- Smooth transition into edit mode
- Clear visual feedback on validation error
- Immediate UI update after rename

### Previous Story Intelligence

**From Story 2.1 (Create and List):**
- generateUniqueName function exists for name collision handling
- Scripts Map preserves insertion order
- API response format: { id, name, code, language, updated_at }

**From Story 2.3 (Save):**
- saveScript action pattern for API calls
- Error handling with scriptsError state
- isSaving state for loading feedback

**From Story 2.4 (Autocomplete):**
- Monaco updates automatically when script data changes
- No special handling needed for editor content

**From Story 2.5 (Error Detection):**
- Editor options include glyphMargin, hover
- Monaco handles JavaScript validation automatically

### Project Structure Notes

**Existing src/components/editor:**
- ScriptsPanel.tsx (main component for file list)
- MonacoEditor.tsx (editor component)
- SaveIndicator.tsx (save status display)
- index.ts (exports)

**No new components strictly required** - inline editing can be done within ScriptsPanel.tsx by conditionally rendering input vs span. However, extracting `ScriptListItem` as a sub-component may improve code organization.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6: Rename AI File]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual Design Foundation]
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Service Laravel]
- [Source: src/components/editor/ScriptsPanel.tsx]
- [Source: src/stores/editorStore.ts]
- [Source: lachatadede-api/app/Http/Controllers/ScriptController.php]
- [Source: _bmad-output/implementation-artifacts/2-5-code-error-detection.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No significant debugging required.

### Completion Notes List

- Implemented right-click context menu with "Rename" option for script items
- Added inline rename input with VSCode-style aesthetics (#3c3c3c background, #007acc focus border)
- Implemented double-click detection to trigger rename mode (200ms timeout to distinguish single vs double click)
- Added keyboard handlers: Enter/Tab to confirm, Escape to cancel
- Implemented blur handler to save on click outside
- Added validation for empty names, invalid characters (/\:*?"<>|), and max length (255 chars)
- Auto-appends .js extension if missing
- Added `renameScript` action to editorStore with `isRenaming` state
- API uses existing PUT /api/scripts/{id} endpoint - no backend changes needed
- Script list and editor header update immediately on successful rename
- Added comprehensive unit tests (12 new tests) for renameScript store action
- Added comprehensive E2E tests (9 new tests) for rename UI flow

### File List

- src/components/editor/ScriptsPanel.tsx (modified)
- src/stores/editorStore.ts (modified)
- tests/unit/stores/editor-store.test.ts (modified)
- tests/e2e/workspace.spec.ts (modified)

## Change Log

- 2026-02-02: Implemented rename AI file feature (Story 2.6)

