# Story 3.2: Tactic Tabs & Auto-Saved Lineups

Status: ready-for-dev

> Revised 2026-09-12 (party-mode session): this story REPLACES the original "Team Lineup Configuration UI" design. The `LineupDialog` modal (5 slot selects) is dead. Tactics are now managed by a tab bar above the field, every edit auto-saves, and there is no draft state. The epics.md entry for 3.2 should be updated to match.

## Story

As a user,
I want to manage multiple team lineups as tabs above the field,
So that I can create, switch, and refine as many tactics as I want without ever losing work.

## Acceptance Criteria

1. **Given** I am on the workspace, **When** I look between the header and the field canvas, **Then** I see a tab bar listing my tactics, **And** the active tactic is highlighted, **And** clicking a tab loads that tactic into the canvas.

2. **Given** I click the "+" button in the tab bar, **Then** a new tactic with the default formation (5 pre-placed slots, no scripts assigned) is created via the API, **And** its tab becomes active immediately, **And** the canvas shows the default positions — never an empty field.

3. **Given** I modify a tactic (move a player on the canvas, or drop a script onto a player), **When** the action completes (drop/move end), **Then** the change persists automatically via the tactics API with no manual save action, **And** I see brief "saved" feedback near the tab.

4. **Given** I double-click a tab, **When** I type a new name and press Enter (or blur), **Then** the name persists via the API, **And** Escape cancels the rename.

5. **Given** a tactic tab shows a delete affordance, **When** I delete it with confirmation, **Then** the tab disappears, **And** a neighboring tactic becomes active and loads in the canvas, **And** when it was the last tactic a fresh default one is automatically created (the user always keeps at least one tactic).

6. **Given** I open the workspace, **When** I have no tactics yet, **Then** a default tactic ("Tactic 1", default formation) is automatically created and activated, **And** the canvas shows its players; **Given** I reload the session, **When** the workspace mounts, **Then** my tactics are fetched and the last active tactic hydrates the canvas.

7. **Given** not all 5 positions have scripts assigned, **When** I view the header, **Then** the "Test vs Bot" button (replacing the non-functional "Simulate" placeholder) is disabled with helper message "Assign AIs to all 5 positions", **And** it is enabled when all 5 have scripts.

## Tasks / Subtasks

### Frontend Tasks (React + Zustand)

- [x] Task 1: Create `TabBar` component `src/components/tactics/TabBar.tsx` (AC: #1, #2, #4, #5)
  - [x] Renders one tab per user tactic from `useTacticsStore` (`tactics[]`, active = `activeTacticId`); active tab visually distinct
  - [x] "+" button `data-testid="new-tactic-button"` → store `createTactic()`
  - [x] Double-click tab → inline rename input `data-testid="tab-rename-input"`; Enter/blur commits, Escape reverts
  - [x] Delete affordance (trash icon on the active tab) with confirm dialog (reuse the Story 2.8 dialog pattern); visible even on the last tactic — deleting it recreates a default one
  - [x] Overflow: tabs shrink then bar scrolls horizontally beyond ~6-7 tabs
  - [x] Tiny "saved ✓" indicator near the tab after a successful auto-save (fades after ~1.5s)
  - [x] No system tactics rendered in MVP (`isSystem` filtered out)
- [x] Task 2: Extend `src/stores/tacticsStore.ts` (AC: #2, #3, #5)
  - [x] `createTactic()`: POST with the 5 default-formation slots (see Dev Notes), auto-name `Tactic N` (N = existing count + 1, API allows duplicates), set `activeTacticId` on success
  - [x] `deleteTactic(id)`: DELETE; on success remove from list; if deleted tactic was active, promote a neighbor to `activeTacticId`; if it was the last tactic, immediately `createTactic()` (always-≥1 invariant)
  - [x] Rename via existing `updateTactic(id, { name })`; position/assignment saves via existing `saveTactic`/`updateTactic` with full `players` payload
  - [x] Track save feedback state (`lastSavedTacticId` + `lastSavedAt`) for the tab indicator; keep existing in-flight save/update guards
- [x] Task 3: Canvas read-back + change events (AC: #3)
  - [x] Add `getTactic()` to `Game` (`src/components/canvas/engine/Game.ts`) and `TacticsCanvasHandle` (`src/components/canvas/TacticsCanvas.tsx`): returns current home players' `{playerSlot, positionX, positionY, scriptId}` (there was NO way to read engine state back — this is new)
  - [x] Emit a change event on script assignment (`onScriptAssigned` in `GameCallbacks`, passed through as `onScriptAssigned` prop)
- [x] Task 4: Auto-save wiring in `AppShell.tsx` (AC: #3)
  - [x] On script-assigned: read `canvasRef.current.getTactic()` → `updateTactic(activeTacticId, { players })`
  - [x] Discrete actions only — never save mid-drag; no debounce needed
  - [x] In-flight guards from the store prevent overlapping PUTs
- [x] Task 5: Hydration on workspace mount (AC: #6)
  - [x] `AppShell.tsx`: `fetchTactics()` on mount; select last active tactic (remembered in `localStorage.last_active_tactic_id`); `loadTactic()` it into the canvas (bridge `TacticConfig` → `TacticData`); guard against the known `Game.init` async race (queue-until-initialized already handled inside `Game.loadTactic`)
  - [x] **Demo tactic removed entirely**: when the user has no tactics, `createTactic()` auto-creates the default one — the canvas is always backed by a real tactic (never an empty field, never an unsaveable demo)
- [x] Task 6: Header gating (AC: #7)
  - [x] "Test vs Bot" button `data-testid="test-vs-bot-button"` replaces "Simulate" in `src/components/layout/Header.tsx`; disabled unless all 5 slots have a `scriptId` (read from active tactic)
  - [x] Helper message `data-testid="lineup-incomplete-message"`: "Assign AIs to all 5 positions" when disabled
  - [x] Enabled click calls `onStartPractice(tacticConfig)` prop from AppShell; in THIS story AppShell logs the payload — Story 3.5 replaces the handler
  - [x] Dead "Save"/"Load" placeholder buttons removed (auto-save makes them lies)
- [x] Task 7: Unit tests — `tests/unit/stores/tactics-store.test.ts` extensions + TabBar component test (AC: #1-#5)
  - [x] createTactic posts default slots and sets active; deleteTactic promotes neighbor and recreates a default when deleting the last; rename commits and Escape reverts; same script assignable to multiple slots via drop

### Testing Tasks (E2E)

- [x] Task 8: E2E `tests/e2e/tactic-tabs.spec.ts` (AC: #1-#7)
  - [x] Fresh user → default tactic auto-created → rename → drop script onto players → switch tabs → changes persisted → reload page → tactic restored → delete active tab promotes neighbor → delete last tactic recreates a default → Test vs Bot disabled until 5 assigned, enabled after

## Dev Notes

- **No draft state — this is the core design decision.** The database is always the source of truth for tactics. Every modification is an API save at action completion (drop, rename). The ONLY draft state in the product is the Monaco editor, which is untouched by this story: scripts belong to the user, not to the tactic, so tab switching must never touch script editing state.
- **Always-≥1-tactic invariant (revised 2026-09-12):** a user without tactics gets a default one auto-created on workspace mount; deleting the last tactic immediately recreates a default one. The demo tactic fallback was REMOVED — the canvas is always backed by a real, saveable tactic (a composition, its players and script assignments all depend on a tactic).
- **Script assignment path:** drag & drop from ScriptsPanel onto canvas players already works (`TacticsCanvas.tsx` drop → `assignScript`). The dead modal's slot selects are gone, so drag & drop is now the PRIMARY assignment path. A script deleted after assignment leaves `scriptId: null` (FK SET NULL from 3.1) — render as unassigned, never crash on a missing script.
- **Default formation** (percent units, matches Story 3.6 bot geometry; API bounds x 0-100, y 0-50): slot 1 GK (8, 25), slot 2 DEF (25, 15), slot 3 DEF (25, 35), slot 4 ATK (60, 15), slot 5 ATK (60, 35). All `scriptId: null` on creation.
- **Coordinate bridge:** the engine renders y in 0-100 (full field height) while the API stores y in 0-50 (half-field units) — `src/lib/tacticBridge.ts` scales y by ×2 on the way in and ÷2 on the way out. Engine player ids are stable (`home-{slot-1}`) so save round-trips cleanly.
- Slots are `1..5` integers everywhere (API, engine). GK/DEF/ATK labels are pure UI sugar — never derive logic from labels.
- **TacticConfig → TacticData bridge:** the store's `TacticConfig` (camelCase API shape) differs from the engine's `TacticData` (players with `Player[]`). Map on hydration and on save.
- Use `apiClient` from 3.1 for all calls. No direct `fetch` in new code.
- Auto-name rule for "+": `Tactic N` where N counts the user's existing tactics + 1 (API permits duplicate names; tabs must not rely on name uniqueness — key tabs by id).
- Deleting the active tactic must leave the app with a valid active tactic (promote neighbor, or recreate default when last) and the canvas reloaded — this is the most failure-prone flow (see Murat's risk list).
- Architecture compliance: TypeScript strict, English-only code/comments, inline styles object pattern (existing), Zustand for state, `data-testid` on every interactive element.

### Test Selectors

| Selector | Element |
|----------|---------|
| `[data-testid="tab-bar"]` | Tab bar container |
| `[data-testid="tactic-tab"]` | A tactic tab (active tab also has `aria-current="true"`) |
| `[data-testid="new-tactic-button"]` | "+" button |
| `[data-testid="tab-rename-input"]` | Inline rename input |
| `[data-testid="delete-tactic-button"]` | Delete affordance on active tab |
| `[data-testid="saved-indicator"]` | Brief "saved ✓" feedback |
| `[data-testid="test-vs-bot-button"]` | Header button (replaces "Simulate") |
| `[data-testid="lineup-incomplete-message"]` | Disabled-state helper message |

### Previous Story Intelligence

- From 3.1: tactics API returns camelCase `{id, name, isSystem, players: [{playerSlot, positionX, positionY, scriptId}]}`; 404 scoping; `tacticsStore` already exists with `fetchTactics/saveTactic/updateTactic/selectTactic/activeTacticId` reconciliation — extend, don't rewrite.
- From 3.1: NO `createTactic()` action exists yet — `saveTactic(name, slots)` is the closest but has different semantics; add the dedicated action.
- From 2.8: dialog overlay pattern (`position: fixed`, backdrop `rgba(0,0,0,0.5)`, `#252526` panel, Escape/overlay-click close) — reuse for delete confirmation.
- From deferred-work.md: AppShell → async `Game.init` → `pendingTactic` queue race is a KNOWN issue — when hydrating on mount, guard `loadTactic` calls the same way the demo tactic does (queue-until-initialized is already handled inside Game.loadTactic).

### Project Structure Notes

- New: `src/components/tactics/TabBar.tsx` + barrel `index.ts`
- Update: `src/components/layout/Header.tsx` (Test vs Bot), `src/components/layout/AppShell.tsx` (TabBar mount, auto-save, hydration), `src/components/canvas/TacticsCanvas.tsx` (handle: `getTactic`), `src/components/canvas/engine/Game.ts` (read-back + change events), `src/stores/tacticsStore.ts` (create/delete/save feedback)
- Reuse: `src/lib/apiClient.ts`, `src/types/shared.ts`, ScriptsPanel drag source (unchanged)
- Deleted plan: `src/components/lineup/LineupDialog.tsx` — do not create

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Team Lineup Configuration UI] (needs update to match this revision)
- [Source: _bmad-output/planning-artifacts/prd.md#Journey Requirements Summary (Pre-Match Lineup Screen)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#The Test Phase]
- [Source: src/components/layout/AppShell.tsx#createDemoTactic] (default-formation source + hydration pattern to replace)
- [Source: src/components/canvas/TacticsCanvas.tsx] (drop → assignScript flow; handle to extend)
- [Source: src/components/editor/ScriptsPanel.tsx] (drag source + dialog pattern)
- [Source: _bmad-output/implementation-artifacts/3-1-tactics-data-model-and-api.md]

## Dev Agent Record

### Agent Model Used

euria-code (infomaniak/euria-code) via opencode, party-mode session 2026-09-12

### Debug Log References

- First e2e run: 3× firefox/webkit failures on the auto-save spec — root cause was the spec still clicking "+" on top of the new mount-time auto-create (two tactics existed; after reload "Tactic 2" was active). Fixed the spec, not the app.
- Monaco-related pre-existing issues confirmed unrelated: 13 unhandled rejections in `monaco-editor.test.tsx` (unit) and 3 flaky Monaco e2e tests (2.4 autocomplete ×2, 2.5 squiggles — pass on retry).

### Completion Notes List

- AC #5/#6 revised during the story (party decision): always-≥1-tactic invariant replaces the "delete hidden on last tactic" rule; demo tactic fallback removed in favor of mount-time auto-create.
- `createTactic`/`saveTactic`/`selectTactic` persist `localStorage.last_active_tactic_id` so a reload restores the last active tactic.
- Engine read-back added: `Game.getTactic()` + `GameCallbacks.onScriptAssigned` (fires after `assignScript`), exposed on `TacticsCanvasHandle`.
- Verification at wrap-up: unit 297/297 green (12 files), lint 0 errors (5 pre-existing warnings), `tsc` clean, tactic-tabs e2e 9/9 (chromium+firefox+webkit), full workspace+auth e2e 187 passed / 0 failed (3 Monaco-flaky on first attempt, 5 total first-attempt failures all Monaco-related).

### File List

- `src/components/tactics/TabBar.tsx` (new) + `src/components/tactics/index.ts` (new)
- `src/lib/tacticBridge.ts` (new — TacticConfig ↔ TacticData + y-axis scaling)
- `src/stores/tacticsStore.ts` (createTactic, deleteTactic + always-≥1 invariant, last-active persistence, saved feedback state)
- `src/components/canvas/engine/Game.ts` (getTactic, onScriptAssigned, tactic identity tracking)
- `src/components/canvas/engine/Player.ts` (read-back getters)
- `src/components/canvas/TacticsCanvas.tsx` (onScriptAssigned prop, getTactic handle, field-canvas testid)
- `src/components/layout/AppShell.tsx` (TabBar mount, hydration + auto-create, auto-save wiring, start-practice hand-off, demo tactic removed)
- `src/components/layout/Header.tsx` (Test vs Bot gating, Save/Load placeholders removed)
- `tests/unit/stores/tactics-store.test.ts` (create/delete/invariant/selection tests)
- `tests/unit/components/tab-bar.test.tsx` (new — 13 component tests)
- `tests/e2e/tactic-tabs.spec.ts` (new — 3 specs × 3 browsers)
