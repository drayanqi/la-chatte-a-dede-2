# Story 2.1: Create and List AI Files

Status: review

## Story

As a user,
I want to create new AI files and see all my files,
So that I can organize multiple strategies.

## Acceptance Criteria

1. **Given** I am in the workspace, **When** I click "New AI File", **Then** a new file is created with default name "NewAI.js", **And** the file appears in my file list, **And** the editor opens with the new file.

2. **Given** I have multiple AI files, **When** I view the file list, **Then** I see all my files sorted by last modified, **And** I can click any file to open it in the editor.

## Tasks / Subtasks

### Backend Tasks (Laravel) - ALREADY COMPLETE

- [x] Task 1: Script CRUD API (AC: #1, #2) - ALREADY IMPLEMENTED
  - [x] `POST /api/scripts` - Create new script (already exists)
  - [x] `GET /api/scripts` - List scripts sorted by updated_at desc (already exists)
  - [x] `GET /api/scripts/{id}` - Get single script (already exists)
  - [x] All endpoints protected by `auth:sanctum` middleware

### Frontend Tasks (React)

- [x] Task 2: Create Script API Integration (AC: #1)
  - [x] Add `createScript(name: string, code?: string)` async action to `editorStore.ts`
  - [x] Call `POST /api/scripts` with Bearer token auth
  - [x] On success: add new script to `scripts` Map AND open it in editor
  - [x] On failure: set `scriptsError` with message
  - [x] Add `isCreatingScript` loading state

- [x] Task 3: "New AI File" Button Functionality (AC: #1)
  - [x] Add `onClick` handler to existing "+" button in ScriptsPanel header
  - [x] Generate default name: "NewAI.js" (or "NewAI (1).js" if exists)
  - [x] Generate default code using the starter template structure
  - [x] Call `createScript()` from store
  - [x] Show loading state on button during creation
  - [x] Add `data-testid="create-script-button"` to the button

- [x] Task 4: Auto-Open Created Script in Editor (AC: #1)
  - [x] After successful creation, call `openScript(newScriptId)`
  - [x] Ensure the new script appears at top of list (sorted by last modified)
  - [x] Scroll to new script if list is long

- [x] Task 5: Script List Sorting (AC: #2)
  - [x] Verify scripts display sorted by `lastModified` DESC (most recent first)
  - [x] Currently `fetchScripts()` orders by `updated_at DESC` - ensure frontend preserves order
  - [x] Add visual indicator for selected script (highlight)

- [x] Task 6: Add data-testid Attributes (AC: #1, #2)
  - [x] `[data-testid="create-script-button"]` - "+" button
  - [x] `[data-testid="script-creating"]` - Loading state while creating
  - [x] Existing test IDs already present: `scripts-list`, `script-item-{id}`, `script-name-{id}`

### Testing Tasks

- [x] Task 7: Unit Tests for createScript Action
  - [x] Test successful creation adds script to Map
  - [x] Test created script becomes active (opened in editor)
  - [x] Test error handling on API failure
  - [x] Test loading state during creation
  - [x] Test duplicate name handling (concurrent creation prevention)

- [x] Task 8: E2E Tests for Create & List (AC: #1, #2)
  - [x] Test: Click "+" creates new file with default name
  - [x] Test: Created file opens in editor automatically
  - [x] Test: File appears in list after creation
  - [x] Test: Click file in list opens it
  - [x] Test: Multiple files maintain sort order by last modified

## Dev Notes

### What Already Exists

**Backend (COMPLETE):**
- `ScriptController.php` with full CRUD at `lachatadede-api/app/Http/Controllers/ScriptController.php`
- API routes in `lachatadede-api/routes/api.php`:
  - `POST /api/scripts` - Create script
  - `GET /api/scripts` - List scripts (sorted by updated_at DESC)
  - `GET /api/scripts/{id}` - Get single script
  - `PUT /api/scripts/{id}` - Update script
  - `DELETE /api/scripts/{id}` - Delete script

**Frontend (PARTIAL):**
- `editorStore.ts` at `src/stores/editorStore.ts`:
  - Has `fetchScripts()` - fetches from API
  - Has `addScript()` - adds to Map (local only)
  - Has `openScript(id)` - sets active script
  - MISSING: `createScript()` - API call to create
- `ScriptsPanel.tsx` at `src/components/editor/ScriptsPanel.tsx`:
  - Renders script list with correct test IDs
  - Has "+" button but NO onClick handler
  - Supports drag-and-drop to tactics canvas

### Default Script Template

Use this template for new scripts:

```javascript
// AI Script: {name}
// Created: {date}

function update(me, ball, teammates, opponents, goal) {
  // Your AI logic here

  // Example: Move toward the ball if closest
  if (me.isClosestToBall()) {
    me.moveTo(ball.position.x, ball.position.y);
  }
}
```

### API Request/Response Format

**Create Script:**
```
POST /api/scripts
Headers:
  Authorization: Bearer <token>
  Accept: application/json
  Content-Type: application/json

Body:
{
  "name": "NewAI.js",
  "code": "function update...",
  "language": "javascript"
}

Response (201):
{
  "id": "uuid",
  "name": "NewAI.js",
  "code": "function update...",
  "language": "javascript",
  "updated_at": "2026-01-26T12:00:00Z"
}
```

### Architecture Compliance

**CRITICAL: All code, comments, variable names MUST be in English.**

**Frontend Patterns (from existing code):**
- State: Zustand store with actions
- Styling: Inline styles object (NO CSS files)
- TypeScript: Strict mode enabled
- API calls: `fetch()` with Bearer token from localStorage
- Error handling: Set `scriptsError` state, display in UI
- Loading state: Set `isLoadingX` before async, clear after

**File Locations:**
- Store: `src/stores/editorStore.ts`
- Component: `src/components/editor/ScriptsPanel.tsx`
- Types: `src/types/shared.ts` (Script interface already defined)

### Previous Story Intelligence

From Story 1.4 implementation:
- Auth token stored in localStorage (key: `auth_token`)
- API calls use both `Authorization: Bearer <token>` header AND `credentials: 'include'`
- Error handling pattern: check `response.ok`, parse JSON for error message
- Loading state pattern: set before fetch, clear in finally/catch
- Scripts Map stores `Script` objects with `lastModified` as `Date`

### Critical Guardrails

1. **NO hardcoded scripts** - All scripts come from API
2. **Preserve Map key ordering** - Scripts should appear in order received from API
3. **Handle race conditions** - Don't allow multiple simultaneous creates
4. **Optimistic UI optional** - Prefer wait-for-server confirmation for MVP
5. **Duplicate name handling** - If "NewAI.js" exists, use "NewAI (1).js", "NewAI (2).js"

### Test Selectors (MANDATORY)

| Selector | Element |
|----------|---------|
| `[data-testid="scripts-list"]` | Script list container (EXISTS) |
| `[data-testid="script-item-{id}"]` | Individual script item (EXISTS) |
| `[data-testid="script-name-{id}"]` | Script name text (EXISTS) |
| `[data-testid="create-script-button"]` | "+" new file button (ADD) |
| `[data-testid="script-creating"]` | Creating indicator (ADD) |

### UX Requirements (from UX Spec)

- **VSCode Dark theme** - Background `#252526`, text `#ffffff`
- **Font**: System UI for labels, monospace for code
- **Interactions**: Hover states, click feedback
- **Loading states**: Show "Creating..." text, disable button
- **Error states**: Red text (`#f14c4c`), clear message

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Create and List AI Files]
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Scripts API]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design System Foundation]
- [Source: _bmad-output/planning-artifacts/test-design-epic-2.md#Story 2.1]
- [Source: lachatadede-api/app/Http/Controllers/ScriptController.php]
- [Source: src/stores/editorStore.ts]
- [Source: src/components/editor/ScriptsPanel.tsx]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- npm dependency issue with @rollup/rollup-darwin-x64 - resolved by reinstalling node_modules
- All 134 unit tests pass
- TypeScript compilation successful

### Completion Notes List

**2026-01-26:**

1. **createScript Action (editorStore.ts):**
   - Added `isCreatingScript` state to EditorState interface
   - Added `createScript(name: string, code?: string)` action to EditorActions interface
   - Implemented `createScript` with:
     - Authentication check (requires auth_token in localStorage)
     - Concurrent creation prevention (returns early if already creating)
     - POST /api/scripts API call with Bearer token
     - Error handling with appropriate error messages
     - Auto-opens created script by setting activeScriptId
     - Inserts new script at top of Map (most recent first)
   - Added `generateDefaultCode()` helper function for default script template

2. **ScriptsPanel.tsx Updates:**
   - Added `generateUniqueName()` function to handle duplicate names (NewAI.js, NewAI (1).js, etc.)
   - Wired up "+" button with onClick handler calling createScript
   - Added data-testid="create-script-button" attribute
   - Added data-testid="script-creating" for loading state
   - Added disabled state and visual feedback during creation

3. **Unit Tests (editor-store.test.ts):**
   - Added 8 new tests for createScript action:
     - should create script successfully via API
     - should open created script in editor automatically
     - should set loading state during creation
     - should handle creation error gracefully
     - should handle network error during creation
     - should not create without auth token
     - should send correct API request with custom code
     - should prevent concurrent script creation

4. **E2E Tests (workspace.spec.ts):**
   - Updated Story 2.1 tests with correct data-testid selectors
   - Added @P0/@P1 priority markers
   - Fixed authentication setup (localStorage instead of cookies)
   - Marked future story tests (2.2-2.8) as skipped with proper labels

### File List

**Files modified:**
- src/stores/editorStore.ts (added createScript action, isCreatingScript state)
- src/components/editor/ScriptsPanel.tsx (wired button, added test IDs)
- tests/unit/stores/editor-store.test.ts (added 8 createScript tests)
- tests/e2e/workspace.spec.ts (updated to match implementation)

**Files unchanged (already complete):**
- lachatadede-api/app/Http/Controllers/ScriptController.php
- lachatadede-api/routes/api.php

## Change Log

- 2026-01-26: Implemented Story 2.1 - Create and List AI Files
  - Added createScript API integration to editorStore
  - Wired up "+" button in ScriptsPanel with proper UX
  - Added comprehensive unit tests (8 new tests, 134 total passing)
  - Updated E2E tests with correct selectors
