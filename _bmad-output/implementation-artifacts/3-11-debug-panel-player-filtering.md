# Story 3.11: Debug Panel — Player Filtering

Status: ready-for-dev

## Story

As a user,
I want to filter logs by player,
So that I can focus on specific AI behavior.

## Acceptance Criteria

1. **Given** the replay is showing, **When** I click a player on the pitch, **Then** the debug panel filters to show only that player's logs, **And** the selected player is highlighted on the pitch.

2. **Given** I have filtered by player, **When** I click the same player again (or click "Show All"), **Then** the filter is cleared and all logs are shown.

3. **Given** I am viewing filtered logs, **When** I scrub the timeline, **Then** filtered logs stay filtered to the selected player, **And** I can identify which player triggered each log entry.

## Tasks / Subtasks

### Frontend Tasks (React)

- [ ] Task 1: Filter state in `canvasStore` (AC: #1, #2)
  - [ ] `logFilterPlayerId: string | null` (`{team, slot}` composite or existing selected-player id convention) + `setLogFilter(id | null)`
  - [ ] Clicking a player on the pitch ALREADY emits `PLAYER_SELECTED` → `canvasStore.setSelectedPlayer` (wired in AppShell): on selection change, if the player has logs, set filter to it; clicking the SAME player again clears filter (toggle semantics in one AppShell/Detected handler, not inside Game)
  - [ ] Keep `selectedPlayerId` (pitch highlight, yellow ring — exists in PlayerSprite) and `logFilterPlayerId` synchronized: selecting drives both; only "Show All" clears the log filter without deselecting the player
- [ ] Task 2: "Show All" control (AC: #2)
  - [ ] Pill button `data-testid="debug-show-all-button"` appears in the panel header while filtered (with player tag of current filter); click → clear filter
  - [ ] Header shows active filter state: "Showing P3 (challenger) only"
- [ ] Task 3: Filtered log pipeline (AC: #1, #3)
  - [ ] `filterLogsByPlayer(logs, playerId)` pure fn in `src/lib/replayLogs.ts` (extend 3.10's module) — applied BEFORE windowing so the ±1s window shows the filtered stream; filter applies during scrubbing automatically since both derive from `canvasStore.currentFrame` (AC #3 for free)
  - [ ] Empty filtered state: "No logs from P3 within ±1s" (distinct from 3.10's empty states)
- [ ] Task 4: Player → log affordance both directions (AC: #1)
  - [ ] Pitch click → filter (Task 1); ALSO: clicking a player tag chip on a log entry selects that player on pitch (highlight + filter) — cheap symmetry, huge UX win (DevTools mental model from UX spec)
- [ ] Task 5: Unit tests
  - [ ] `filterLogsByPlayer` (match both, team+slot composite matching, empty result)
  - [ ] Store: toggle semantics (select→filter on, re-select→filter off, Show All keeps selection), filter survives frame changes
- [ ] Task 6: E2E (`practice-match.spec.ts`) (AC: #1-#3)
  - [ ] Replay with two logging players → click P2 on pitch → only P2 entries visible + highlight on pitch; click P2 again → all logs; scrub while filtered → still only P2; "Show All" clears; click log chip P5 → P5 selected+filtered

## Dev Notes

- This is the UX spec's flagship novel pattern ("Click-to-Filter Debug — no existing tool does this"): the click→filter path must be EXACTLY 1 click (success criteria in ux-design-specification.md) — no intermediate mode toggles.
- Player identity: `{team: 'challenger'|'opponent', slot: 1-5}` — the engine's identity model (3.4/3.7). Whatever id shape `canvasStore.selectedPlayerId` uses today, keep ONE canonical composite (see teamMapping helper from 3.7) — no string-parsing ad hoc ids.
- Toggle semantics decision (AC #2 "click same player again"): second click clears the LOG FILTER but keeps the pitch highlight; "Show All" does the same. Deselection (clicking empty pitch) clears both.
- Filter + windowing order: filter FIRST then `logsAroundTick` — otherwise a quiet player in a busy window renders nothing misleadingly.
- Monaco input guard applies to pitch clicks? No — pointer events only; keyboard nav untouched (3.9).
- Panel already renders P-chips (3.10) — chips become clickable buttons (keyboard accessible) in this story.
- Architecture compliance: English-only code/comments, TypeScript strict, inline styles, data-testids on every new control.

### Test Selectors

| Selector | Element |
|----------|---------|
| `[data-testid="debug-show-all-button"]` | Clear-filter control |
| `[data-testid="debug-filter-indicator"]` | "Showing P3 only" header state |
| `[data-testid="debug-log-entry-{i}-player-chip"]` | Clickable player chip on entries |
| pitch player hit area | existing PlayerSprite pointer target (assert via canvas click coordinates in e2e, as done for drag&drop) |

### Previous Story Intelligence

- From 3.10: panel structure, chips, empty states, follow-pill — extend, don't rewrite; keep 3.10 tests passing.
- From 3.7: PlayerSprite already highlights selected player (yellow ring) and emits pointer events; TacticsCanvas hit-testing exists (drag&drop uses `hitTestPlayer`) — reuse for click selection.
- From 3.9: scrubbing auto-updates panel via currentFrame — no extra sync work needed for AC #3, but test it explicitly.
- From UX spec: "Click-to-Filter | Exactly 1" is a measurable success criterion — the e2e click count IS the spec compliance check.

### Project Structure Notes

- Update: `src/stores/canvasStore.ts` (filter state), `src/components/debugger/DebuggerPanel.tsx`, `src/components/layout/AppShell.tsx` (click wiring), `src/lib/replayLogs.ts`
- Update: `tests/e2e/practice-match.spec.ts`, `tests/unit/stores/canvas-store.test.ts`, `tests/unit/lib/replay-logs.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.11: Debug Panel - Player Filtering]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Novel UX Patterns (Click-to-Filter) + Success Criteria (Exactly 1 click)]
- [Source: src/components/canvas/TacticsCanvas.tsx] (hitTestPlayer + selection wiring)
- [Source: _bmad-output/implementation-artifacts/3-10-debug-panel-log-display.md] (panel pipeline this story extends)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
