# Story 3.2: Team Lineup Configuration UI

Status: ready-for-dev

## Story

As a user,
I want to assign my AI scripts to the 5 player positions,
So that I can create team strategies with different roles.

## Acceptance Criteria

1. **Given** I am preparing for a match, **When** I open the lineup screen, **Then** I see 5 player slots with positions labeled (GK, DEF1, DEF2, ATK1, ATK2), **And** I can select any of my AI scripts for each slot.

2. **Given** I assign different AIs to different positions, **When** I view my lineup, **Then** each position shows its assigned AI name, **And** I can assign the same AI to multiple positions.

3. **Given** not all 5 positions have AIs assigned, **When** I try to start a match, **Then** the "Start Match" button is disabled, **And** I see a message "Assign AIs to all 5 positions".

4. **Given** all 5 positions have AIs, **When** I view the lineup, **Then** the "Start Match" button is enabled.

5. **Given** I configure a lineup, **When** I save it, **Then** it persists via the tactics API (Story 3.1) and reloads on my next session.

## Tasks / Subtasks

### Frontend Tasks (React + Zustand)

- [ ] Task 1: Create `LineupDialog` component `src/components/lineup/LineupDialog.tsx` (AC: #1, #2)
  - [ ] Modal overlay reusing the dialog pattern/styles from ScriptsPanel delete confirmation (Story 2.8)
  - [ ] 5 slot rows labeled `GK (Slot 1)`, `DEF1 (Slot 2)`, `DEF2 (Slot 3)`, `ATK1 (Slot 4)`, `ATK2 (Slot 5)` — labels are display-only; the data model stores `playerSlot` 1-5
  - [ ] Each row: `<select data-testid="slot-select-{n}">` listing user scripts (name, value = script id) + "— Unassigned —" option; same script selectable in multiple slots (plain ids, no exclusivity logic)
  - [ ] Each row shows the selected AI's name; default starting positions per slot (see Dev Notes constants) shown as static text — position editing is out of scope for MVP
  - [ ] Tactic name input `data-testid="tactic-name-input"` (default "My Tactic")
  - [ ] "Save Lineup" button → `saveTactic`/`updateTactic` in tacticsStore (Story 3.1)
- [ ] Task 2: Enforce complete-lineup rule (AC: #3, #4)
  - [ ] "Start Match" button `data-testid="start-match-button"` disabled unless all 5 slots have a scriptId
  - [ ] When disabled, render helper message `data-testid="lineup-incomplete-message"`: "Assign AIs to all 5 positions"
  - [ ] When enabled, message hidden
- [ ] Task 3: Wire entry point in Header (AC: #1)
  - [ ] Add "Test vs Bot" button `data-testid="test-vs-bot-button"` to `src/components/layout/Header.tsx` (replaces the non-functional "Simulate" placeholder)
  - [ ] Click opens LineupDialog; close via Cancel / Escape / overlay click
- [ ] Task 4: Load persisted tactic on workspace mount (AC: #5)
  - [ ] In `AppShell.tsx`: call `fetchTactics()` on mount; if the user has a tactic, hydrate the 5 slots from its players and `loadTactic()` it into the canvas (replacing the inline demo tactic when a real tactic exists; keep demo tactic as fallback when user has none)
  - [ ] On save, also `canvasRef.current?.loadTactic(...)` with the scripts the user assigned so the canvas reflects the lineup
- [ ] Task 5: Start Match hand-off (AC: #4)
  - [ ] Enabled "Start Match" calls an `onStartPractice(tacticConfig)` prop passed from AppShell; in THIS story AppShell logs the payload and closes the dialog — Story 3.5 replaces that handler with the real practice-match call
- [ ] Task 6: Unit tests `tests/unit/stores/tactics-store.test.ts` extensions + component test for LineupDialog (AC: #1-#5)
  - [ ] Selecting same script in 2 slots is allowed; slot count = 5; start button disabled/enabled logic; save calls store with correct payload

### Testing Tasks (E2E)

- [ ] Task 7: E2E `tests/e2e/lineup.spec.ts` (AC: #1-#5)
  - [ ] Register → open lineup via "Test vs Bot" → assign StarterAI to 2 slots → same name shows in both → clear one slot → start disabled with message → assign all 5 → enabled → save → reload page → lineup restored (AC: #5)

## Dev Notes

- The lineup screen is a MODAL over the workspace, not a route — PRD flow is "Test vs Bot → lineup appears → confirm → match simulates". Keep the editor visible behind it.
- `script_id` can be null after the underlying script is deleted (FK SET NULL from 3.1) — render those slots as "— Unassigned —" on load, never crash on a missing script in the `scripts` Map.
- Default starting positions (constants, match Story 3.6 bot + demo tactic geometry, percent units): slot 1 GK (8, 25), slot 2 DEF (25, 15), slot 3 DEF (25, 35), slot 4 ATK (60, 15), slot 5 ATK (60, 35). Engine (3.3) receives them per slot from the tactic payload.
- Slots are `1..5` integers everywhere (API, engine). GK/DEF/ATK labels are pure UI sugar — never derive logic from labels.
- Use `apiClient` from 3.1 for all calls. No direct `fetch` in new code.
- Drag & drop onto canvas players already exists in TacticsCanvas (`hitTestPlayer` → `assignScript`) — leave it working; the modal `select` is the primary, accessible path (PRD: "Drag-and-drop (or click-select)").
- Architecture compliance: TypeScript strict, English-only code/comments, inline styles object pattern (existing), Zustand for state, data-testid on every interactive element.

### Test Selectors

| Selector | Element |
|----------|---------|
| `[data-testid="test-vs-bot-button"]` | Header button opening lineup |
| `[data-testid="lineup-dialog"]` | Modal container |
| `[data-testid="tactic-name-input"]` | Tactic name field |
| `[data-testid="slot-select-1"]` … `-5` | Per-slot script selects |
| `[data-testid="save-lineup-button"]` | Save button |
| `[data-testid="start-match-button"]` | Start Match button |
| `[data-testid="lineup-incomplete-message"]` | Disabled-state helper message |

### Previous Story Intelligence

- From 3.1: tactics API returns camelCase `{id, name, isSystem, players: [{playerSlot, positionX, positionY, scriptId}]}`; 404 scoping; `tacticsStore` already exists with `fetchTactics/saveTactic/updateTactic`.
- From 2.8: dialog overlay pattern (`position: fixed`, backdrop `rgba(0,0,0,0.5)`, `#252526` panel, Escape/overlay-click close) — copy it.
- From deferred-work.md: AppShell → async `Game.init` → `pendingTactic` queue race is a KNOWN issue — when hydrating lineup on mount, guard `loadTactic` calls the same way the demo tactic does (queue-until-initialized is already handled inside Game.loadTactic).

### Project Structure Notes

- New: `src/components/lineup/LineupDialog.tsx` + barrel `index.ts`
- Update: `src/components/layout/Header.tsx`, `src/components/layout/AppShell.tsx`, `src/components/layout/index.ts` if exports change
- Reuse: `src/stores/tacticsStore.ts`, `src/lib/apiClient.ts`, `src/types/shared.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Team Lineup Configuration UI]
- [Source: _bmad-output/planning-artifacts/prd.md#Journey Requirements Summary (Pre-Match Lineup Screen)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#The Test Phase]
- [Source: src/components/layout/AppShell.tsx#createDemoTactic] (hydration pattern to replace)
- [Source: src/components/editor/ScriptsPanel.tsx] (dialog pattern)
- [Source: _bmad-output/implementation-artifacts/3-1-tactics-data-model-and-api.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
