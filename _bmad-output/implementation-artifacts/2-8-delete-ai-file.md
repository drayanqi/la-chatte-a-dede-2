# Story 2.8: Delete AI File

Status: review

## Story

As a user,
I want to delete AI files I no longer need,
So that I can keep my workspace organized.

## Acceptance Criteria

1. **Given** I have an AI file, **When** I right-click and select "Delete", **Then** I see a confirmation dialog "Delete [filename]?"

2. **Given** I confirm deletion, **When** the delete completes, **Then** the file is removed from my list, **And** if it was open in the editor, the editor shows another file or empty state.

3. **Given** I cancel deletion, **When** I click "Cancel", **Then** the file remains unchanged.

## Tasks / Subtasks

### Frontend Tasks (React + Zustand)

- [x] Task 1: Add Delete Action to Context Menu (AC: #1)
  - [x] Add "Delete" option to existing context menu in ScriptsPanel.tsx
  - [x] Position below "Duplicate" option for logical grouping
  - [x] Style with error/danger color to indicate destructive action
  - [x] Add appropriate handler function

- [x] Task 2: Implement Confirmation Dialog (AC: #1)
  - [x] Add `deleteConfirmScriptId` state to track which script is pending deletion
  - [x] Create inline confirmation dialog (modal overlay)
  - [x] Display script name in confirmation message: "Delete [filename]?"
  - [x] Add "Delete" (danger) and "Cancel" (neutral) buttons
  - [x] Close dialog on Escape key press

- [x] Task 3: Update deleteScript Action in Editor Store (AC: #2)
  - [x] Modify existing `deleteScript(id: string)` to be async and call API
  - [x] Add `isDeleting` state to track delete in progress
  - [x] Call `DELETE /api/scripts/{id}` endpoint
  - [x] Remove script from local scripts Map on success
  - [x] If deleted script was active, clear activeScriptId or select another script

- [x] Task 4: Handle Editor State After Deletion (AC: #2)
  - [x] If deleted script was open (activeScriptId === id):
    - [x] Select next script in list if available
    - [x] Otherwise select previous script if available
    - [x] Otherwise set activeScriptId to null (empty state)
  - [x] Clear any unsaved changes flag for deleted script

- [x] Task 5: Implement Cancel Behavior (AC: #3)
  - [x] Cancel button closes dialog without action
  - [x] Click outside dialog closes it (cancel behavior)
  - [x] Escape key closes dialog
  - [x] File remains in list unchanged

### Testing Tasks

- [x] Task 6: Unit Tests for Delete Logic
  - [x] Test: deleteScript calls DELETE /api/scripts/{id}
  - [x] Test: deleteScript removes script from Map on success
  - [x] Test: deleteScript sets isDeleting during operation
  - [x] Test: deleteScript clears activeScriptId if deleted script was active
  - [x] Test: deleteScript selects another script if deleted was active
  - [x] Test: deleteScript handles API error gracefully

- [x] Task 7: E2E Tests for Delete Feature (AC: #1, #2, #3)
  - [x] Test: Right-click shows context menu with "Delete" option
  - [x] Test: Clicking "Delete" shows confirmation dialog with filename
  - [x] Test: Confirming deletion removes file from list
  - [x] Test: Confirming deletion closes editor if file was open
  - [x] Test: Cancel button keeps file unchanged
  - [x] Test: Escape key cancels deletion
  - [x] Test: Click outside dialog cancels deletion

## Dev Notes

### Existing Architecture (from Stories 2.6, 2.7)

**ScriptsPanel.tsx** has a context menu with right-click support:
- `contextMenuScriptId` state tracks which script the menu is for
- `contextMenuPosition` tracks x/y position for fixed positioning
- `handleContextMenu` handler opens menu on right-click
- "Rename" and "Duplicate" options already exist

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
    <button data-testid="rename-option" ...>Rename</button>
    <button data-testid="duplicate-option" ...>Duplicate</button>
    {/* Add Delete option here */}
  </div>
)}
```

**editorStore.ts:**
- `deleteScript(id)` action EXISTS but only removes from local Map (no API call)
- `isCreatingScript`, `isRenaming`, `isDuplicating` state patterns
- API URL: `${API_URL}/scripts`

**Backend API Endpoint (ScriptController.php) - ALREADY EXISTS:**
```php
public function destroy(string $id): JsonResponse
{
    $script = Auth::user()->scripts()->find($id);

    if (!$script) {
        return response()->json(['message' => 'Script not found'], 404);
    }

    $script->delete();

    return response()->json(['message' => 'Script deleted successfully']);
}
```
- Route: `DELETE /api/scripts/{id}` (already registered in routes/api.php)
- Returns 404 if script not found or doesn't belong to user
- Returns 200 with success message on deletion

### Implementation Strategy

**Confirmation Dialog Pattern:**
VSCode uses an inline modal for destructive actions. We'll follow this pattern:

```tsx
// Confirmation dialog state
const [deleteConfirmScriptId, setDeleteConfirmScriptId] = useState<string | null>(null);

// Start delete (from context menu)
const handleDeleteClick = (scriptId: string) => {
  setContextMenuScriptId(null); // Close context menu
  setDeleteConfirmScriptId(scriptId); // Open confirm dialog
};

// Confirm delete
const confirmDelete = async () => {
  if (!deleteConfirmScriptId) return;
  await deleteScript(deleteConfirmScriptId);
  setDeleteConfirmScriptId(null);
};

// Cancel delete
const cancelDelete = () => {
  setDeleteConfirmScriptId(null);
};
```

**Delete Flow:**
1. User right-clicks script item → context menu appears
2. User clicks "Delete" option → confirmation dialog appears
3. Dialog shows "Delete [filename]?" with Delete/Cancel buttons
4. User clicks "Delete":
   - Frontend calls `deleteScript(scriptId)`
   - Store calls `DELETE /api/scripts/{id}`
   - On success: remove from scripts Map
   - If deleted script was active: select another or clear
5. Dialog closes
6. (Or) User clicks "Cancel" or Escape → dialog closes, no changes

**Updated deleteScript Action:**
```typescript
deleteScript: async (id: string): Promise<boolean> => {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    set({ scriptsError: 'Not authenticated' });
    return false;
  }

  // Prevent concurrent deletions
  if (get().isDeleting) {
    return false;
  }

  set({ isDeleting: true, scriptsError: null });

  try {
    const response = await fetch(`${API_URL}/scripts/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      set({
        scriptsError: data.message || 'Failed to delete script',
        isDeleting: false,
      });
      return false;
    }

    // Remove from local state and handle active script
    set((state) => {
      const newScripts = new Map(state.scripts);
      newScripts.delete(id);

      // Determine new active script
      let newActiveId = state.activeScriptId;
      if (state.activeScriptId === id) {
        const scriptIds = Array.from(newScripts.keys());
        newActiveId = scriptIds.length > 0 ? scriptIds[0] : null;
      }

      return {
        scripts: newScripts,
        activeScriptId: newActiveId,
        isDeleting: false,
        scriptsError: null,
      };
    });

    return true;
  } catch (error) {
    console.error('Error deleting script:', error);
    set({
      scriptsError: 'Failed to delete script. Please try again.',
      isDeleting: false,
    });
    return false;
  }
},
```

### Architecture Compliance

**CRITICAL: All code, comments, variable names MUST be in English.**

**File Locations:**
- Update: `src/components/editor/ScriptsPanel.tsx` (add Delete menu option + confirmation dialog)
- Update: `src/stores/editorStore.ts` (update deleteScript to async + add isDeleting state)

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
| `[data-testid="duplicate-option"]` | Duplicate menu option (EXISTS) |
| `[data-testid="delete-option"]` | Delete menu option (NEW) |
| `[data-testid="delete-confirm-dialog"]` | Confirmation dialog container (NEW) |
| `[data-testid="delete-confirm-button"]` | Confirm delete button (NEW) |
| `[data-testid="delete-cancel-button"]` | Cancel delete button (NEW) |

### UX Requirements (from UX Spec)

**Destructive Action Pattern:**
- Confirmation required before delete
- Danger styling on Delete button (red/error color)
- Clear action text in dialog

**Keyboard Accessibility:**
- Escape key cancels dialog
- Tab navigation through buttons
- Enter on focused button activates it

**Dialog Behavior:**
- Modal overlay with backdrop
- Click outside closes (cancel)
- Focus trap within dialog

### Previous Story Intelligence

**From Story 2.7 (Duplicate):**
- Context menu now has "Duplicate" option as well as "Rename"
- `isDuplicating` state pattern for async operations
- `duplicateScript(id)` returns `Promise<string | null>`
- Context menu closes before starting operation

**From Story 2.6 (Rename):**
- Context menu implementation with position tracking
- `isRenaming` state for async operations
- Inline editing pattern (but delete uses dialog instead)

**From Stories 2.1-2.5:**
- `createScript(name, code)` action pattern for POST
- `saveScript(id)` action pattern for PUT
- `fetchScripts()` for initial load
- `openScript(id)` for navigation

### Styling Reference

**Confirmation Dialog Styles (VSCode-inspired):**
```typescript
const styles = {
  // ... existing styles ...

  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  dialogContent: {
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '16px',
    minWidth: '280px',
    maxWidth: '400px',
  },
  dialogTitle: {
    fontSize: '14px',
    color: '#ffffff',
    marginBottom: '12px',
  },
  dialogButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '16px',
  },
  dialogButton: {
    padding: '6px 14px',
    borderRadius: '2px',
    fontSize: '13px',
    cursor: 'pointer',
    border: 'none',
  },
  dialogButtonPrimary: {
    backgroundColor: '#0e639c',
    color: '#ffffff',
  },
  dialogButtonDanger: {
    backgroundColor: '#f14c4c',
    color: '#ffffff',
  },
  dialogButtonSecondary: {
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
  },

  contextMenuItemDanger: {
    color: '#f14c4c',
  },
};
```

### Project Structure Notes

**Existing src/components/editor:**
- ScriptsPanel.tsx (context menu exists, add delete option + dialog)
- MonacoEditor.tsx (editor component)
- SaveIndicator.tsx (save status display)
- index.ts (exports)

**No new components required** - keep dialog inline in ScriptsPanel.tsx for simplicity

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.8: Delete AI File]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design System Foundation]
- [Source: lachatadede-api/app/Http/Controllers/ScriptController.php#destroy]
- [Source: src/components/editor/ScriptsPanel.tsx]
- [Source: src/stores/editorStore.ts]
- [Source: _bmad-output/implementation-artifacts/2-7-duplicate-ai-file.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation completed without issues

### Completion Notes List

- Backend DELETE endpoint already exists in ScriptController.php - no backend work needed
- Modified existing `deleteScript` from sync to async with API call
- Added `isDeleting` state following existing patterns (isRenaming, isDuplicating)
- Confirmation dialog follows VSCode-inspired styling
- Comprehensive unit tests added for all delete scenarios
- E2E tests cover all acceptance criteria

### File List

**Modified Files:**
- `src/stores/editorStore.ts` - Added `isDeleting` state, converted `deleteScript` to async with API call
- `src/components/editor/ScriptsPanel.tsx` - Added delete option to context menu, confirmation dialog, cancel/confirm handlers
- `tests/unit/stores/editor-store.test.ts` - Updated delete tests for async API behavior
- `tests/e2e/workspace.spec.ts` - Added Story 2.8 E2E tests

