# Story 2.3: Save AI File Changes

Status: review

## Story

As a user,
I want my code changes to be saved,
So that I don't lose my work.

## Acceptance Criteria

1. **Given** I have made changes to an AI file, **When** I press Cmd+S (or Ctrl+S), **Then** the file is saved to the server, **And** I see a brief "Saved" indicator.

2. **Given** I have unsaved changes, **When** I try to close the file or navigate away, **Then** I am warned about unsaved changes.

3. **Given** the save fails (network error), **When** I try to save, **Then** I see an error message, **And** my changes are preserved locally.

## Tasks / Subtasks

### Backend Tasks (Laravel)

- [x] Task 1: Verify PUT /api/scripts/{id} endpoint (AC: #1)
  - [x] Endpoint already exists from Story 2.1 - verify it accepts `code` field in request body
  - [x] Ensure endpoint returns updated script with `updated_at` timestamp
  - [x] Verify 404 response for non-existent script
  - [x] Verify 403 response if user doesn't own the script

### Frontend Tasks (React)

- [x] Task 2: Add saveScript action to editorStore (AC: #1, #3)
  - [x] Add `saveScript(id: string): Promise<boolean>` action to `src/stores/editorStore.ts`
  - [x] Make PUT request to `/api/scripts/{id}` with current code from store
  - [x] On success: update script's lastModified, call `markSaved()`, return true
  - [x] On failure: set `scriptsError` with message, preserve code in store, return false
  - [x] Add `isSaving` state to track save-in-progress

- [x] Task 3: Add Save Indicator UI (AC: #1)
  - [x] Add `saveStatus: 'idle' | 'saving' | 'saved' | 'error'` state to store
  - [x] Create `SaveIndicator` component in `src/components/editor/SaveIndicator.tsx`
  - [x] Show "Saving..." when `saveStatus === 'saving'`
  - [x] Show "Saved" for 2 seconds when `saveStatus === 'saved'`, then return to idle
  - [x] Show error icon/text when `saveStatus === 'error'`
  - [x] Add to editor header in ScriptsPanel.tsx next to filename
  - [x] Add `data-testid="save-indicator"` for testing

- [x] Task 4: Wire Cmd+S to save action (AC: #1)
  - [x] MonacoEditor already has `onSave` prop - add handler
  - [x] In ScriptsPanel.tsx, create `handleSave` function that calls `saveScript(activeScriptId)`
  - [x] Pass `handleSave` to MonacoEditor's `onSave` prop
  - [x] Prevent default browser save dialog
  - [x] Ensure save is disabled when already saving (debounce)

- [x] Task 5: Add unsaved changes warning (AC: #2)
  - [x] Add `beforeunload` event listener when `hasUnsavedChanges === true`
  - [x] Show browser's native "Leave page? Changes may not be saved" dialog
  - [x] Clean up listener when `hasUnsavedChanges` becomes false or component unmounts
  - [x] Implement in WorkspacePage.tsx or as a custom hook `useUnsavedChangesWarning()`

- [x] Task 6: Handle save failure gracefully (AC: #3)
  - [x] On save error, display error message in SaveIndicator or toast
  - [x] Keep code in store (do NOT revert or lose changes)
  - [x] Allow retry by pressing Cmd+S again
  - [x] Log error to console for debugging

- [x] Task 7: Implement auto-save (Bonus from Test Design - Risk mitigation R2-002)
  - [x] Add auto-save timer: save every 30 seconds if `hasUnsavedChanges === true`
  - [x] Use debounced save (wait 2s after last keystroke, then save)
  - [x] Clear auto-save timer on manual save
  - [x] Add `autoSaveEnabled` preference (default: true)

### Testing Tasks

- [x] Task 8: Unit Tests for saveScript action
  - [x] Test: successful save calls API and updates store
  - [x] Test: failed save preserves code and sets error state
  - [x] Test: save sets isSaving during request
  - [x] Test: hasUnsavedChanges is false after successful save

- [x] Task 9: E2E Tests for Save functionality (AC: #1, #2, #3)
  - [x] Test: Cmd+S saves file to server (verify API call)
  - [x] Test: "Saved" indicator appears after save
  - [x] Test: Unsaved changes warning on page leave
  - [x] Test: Save failure shows error message
  - [x] Test: Auto-save after 30 seconds (use page.clock)

## Dev Notes

### What Already Exists

**editorStore.ts:**
- `updateScript(id, code)` - Updates code in store, sets `hasUnsavedChanges: true`
- `markSaved()` / `markUnsaved()` - State flags
- `hasUnsavedChanges` - Boolean flag for unsaved state
- Missing: `saveScript()` action to persist to API

**MonacoEditor.tsx (lines 21-22, 49-54):**
```typescript
onSave?: () => void;  // Already accepts save handler prop

// Cmd+S keybinding already wired (keybinding 2097)
if (onSave) {
  monacoEditor.addCommand(2097, () => {
    onSave();
  });
}
```

**ScriptsPanel.tsx (lines 134-137):**
```typescript
<MonacoEditor
  value={scripts.get(activeScriptId)?.code ?? ''}
  onChange={(newCode) => updateScript(activeScriptId, newCode)}
  // Missing: onSave={handleSave}
/>
```

**Backend API (from backend-architecture.md):**
```
PUT /api/scripts/{id}
Body: { "code": "...", "name": "..." }
Response: { id, name, code, language, updated_at }
```

### Architecture Compliance

**CRITICAL: All code, comments, variable names MUST be in English.**

**Frontend Patterns:**
- State: Zustand store with actions
- Styling: Inline styles object pattern (match existing ScriptsPanel.tsx)
- TypeScript: Strict mode enabled
- Components: Functional components with hooks
- API calls: Use fetch with Bearer token from localStorage

**File Locations:**
- Update: `src/stores/editorStore.ts` (add saveScript action, save states)
- New component: `src/components/editor/SaveIndicator.tsx`
- Update: `src/components/editor/ScriptsPanel.tsx` (add onSave handler, SaveIndicator)
- New hook (optional): `src/hooks/useUnsavedChangesWarning.ts`

**API Pattern (from editorStore.ts lines 106-148):**
```typescript
const token = localStorage.getItem('auth_token');
const response = await fetch(`${API_URL}/scripts/${id}`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify({ code, name }),
});
```

### UX Requirements (from UX Spec)

**Save Indicator Design:**
- Position: In editor header, next to filename
- Colors:
  - Saving: `#888888` (muted gray)
  - Saved: `#4ec9b0` (success teal)
  - Error: `#f14c4c` (error red)
- Font: 12px, system font
- Animation: Fade in/out for "Saved" indicator
- Duration: Show "Saved" for 2 seconds, then fade

**Keyboard Shortcut:**
- Cmd+S (Mac) / Ctrl+S (Windows) - Already handled by Monaco keybinding 2097

### Test Selectors (MANDATORY)

| Selector | Element |
|----------|---------|
| `[data-testid="save-indicator"]` | Save status indicator container (ADD) |
| `[data-testid="save-indicator-saving"]` | "Saving..." state (ADD) |
| `[data-testid="save-indicator-saved"]` | "Saved" state (ADD) |
| `[data-testid="save-indicator-error"]` | Error state (ADD) |
| `[data-testid="monaco-editor"]` | Monaco editor (EXISTS) |
| `[data-testid="editor-container"]` | Editor wrapper (EXISTS) |

### Test Considerations (from Test Design)

**E2E Save Test Pattern:**
```typescript
// Type in Monaco editor
await page.keyboard.type('// new code');

// Trigger Cmd+S
await page.keyboard.press('Meta+s');

// Wait for save indicator
await expect(page.getByTestId('save-indicator-saved')).toBeVisible();

// Verify API was called
await expect(page).toHaveRequestedUrl(/\/api\/scripts\/\d+/);
```

**Auto-save Test (use Playwright clock):**
```typescript
await page.clock.setTime(Date.now() + 30000);
await expect(page).toHaveRequestedUrl(/\/api\/scripts\/\d+/);
```

**E2E Test Files:**
- `tests/e2e/workspace.spec.ts`

### Risk Mitigation (from Test Design)

**R2-002: User loses unsaved code changes (Risk Score: 6)**
- Implement `beforeunload` warning for unsaved changes
- Auto-save every 30 seconds
- Consider localStorage backup as additional safety net

**Implementation Priority:**
1. Manual Cmd+S save (MUST HAVE)
2. Unsaved changes warning (MUST HAVE)
3. Save indicator UI (MUST HAVE)
4. Auto-save (SHOULD HAVE - from test design risk mitigation)

### Previous Story Intelligence (Story 2.2)

**Patterns established:**
- MonacoEditor component successfully handles keybindings
- Monaco keybinding for Cmd+S already wired (keybinding 2097)
- Zustand store pattern with async actions works well
- ScriptsPanel integrates MonacoEditor with value/onChange pattern

**Files modified in 2.2 that will be touched again:**
- `src/components/editor/ScriptsPanel.tsx` - Add onSave handler, SaveIndicator
- `src/stores/editorStore.ts` - Add saveScript action, save states

**Test patterns from 2.2:**
- Monaco requires `.monaco-editor` selector for E2E
- Use `page.keyboard` for typing and shortcuts
- Wait for Monaco to load before interacting

### Git Intelligence

Recent commits focus on CI/CD fixes and PHP updates. Story 2.2 was the last feature work:
- `0194dad epic 1 + story 2.1` - Script CRUD API exists
- Monaco editor integration complete in Story 2.2

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Save AI File Changes]
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Endpoints API]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Color Strategy]
- [Source: _bmad-output/planning-artifacts/test-design-epic-2.md#Story 2.3]
- [Source: src/stores/editorStore.ts#lines 236-248]
- [Source: src/components/editor/MonacoEditor.tsx#lines 49-54]
- [Source: src/components/editor/ScriptsPanel.tsx#lines 134-137]
- [Source: _bmad-output/implementation-artifacts/2-2-monaco-editor-integration.md]
- [Web: @monaco-editor/react documentation](https://www.npmjs.com/package/@monaco-editor/react)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Backend API verified: PUT /api/scripts/{id} exists with proper validation
- All 9 tasks implemented following story specifications

### Completion Notes List

1. **Task 1**: Verified PUT /api/scripts/{id} endpoint in Laravel backend - accepts code field, returns updated_at, handles 404/403
2. **Task 2**: Added `saveScript(id)` action to editorStore with `isSaving` and `saveStatus` states - handles success/failure properly
3. **Task 3**: Created SaveIndicator component showing Saving/Saved/Error states with auto-hide after 2 seconds
4. **Task 4**: Wired Cmd+S to saveScript via MonacoEditor's existing onSave prop, with debounce protection
5. **Task 5**: Created useUnsavedChangesWarning hook using beforeunload event, integrated in ScriptsPanel
6. **Task 6**: Error handling already covered by Tasks 2 and 3 - errors shown in SaveIndicator, code preserved
7. **Task 7**: Created useAutoSave hook with debounced save (2s) and periodic save (30s) strategies
8. **Task 8**: Added 10 comprehensive unit tests for saveScript action covering success, failure, concurrent saves
9. **Task 9**: Added 5 E2E tests for save functionality including Cmd+S, indicators, error handling, persistence

### File List

**Files created:**
- src/components/editor/SaveIndicator.tsx
- src/hooks/useUnsavedChangesWarning.ts
- src/hooks/useAutoSave.ts
- src/hooks/index.ts

**Files modified:**
- src/stores/editorStore.ts (added saveScript action, isSaving, saveStatus, setSaveStatus)
- src/components/editor/ScriptsPanel.tsx (added SaveIndicator, handleSave, hooks)
- src/components/editor/index.ts (added SaveIndicator export)
- tests/unit/stores/editor-store.test.ts (added saveScript tests)
- tests/e2e/workspace.spec.ts (added Story 2.3 E2E tests)

## Change Log

- 2026-02-01: Story 2.3 implementation complete - Save functionality with Cmd+S, indicators, auto-save, and unsaved changes warning
