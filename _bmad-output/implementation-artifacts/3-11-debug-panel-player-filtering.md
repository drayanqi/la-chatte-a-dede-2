---
baseline_commit: d21e36e171afc65d40fd11fb2c3a894ee2a41e8f
---

# Story 3.11: Debug Panel — Player Filtering

Status: done

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

- [x] Task 1: Filter state in `canvasStore` (AC: #1, #2)
  - [x] `logFilterPlayerId: string | null` (`{team, slot}` composite or existing selected-player id convention) + `setLogFilter(id | null)`
  - [x] Clicking a player on the pitch ALREADY emits `PLAYER_SELECTED` → `canvasStore.setSelectedPlayer` (wired in AppShell): on selection change, if the player has logs, set filter to it; clicking the SAME player again clears filter (toggle semantics in one AppShell/Detected handler, not inside Game)
  - [x] Keep `selectedPlayerId` (pitch highlight, yellow ring — exists in PlayerSprite) and `logFilterPlayerId` synchronized: selecting drives both; only "Show All" clears the log filter without deselecting the player
- [x] Task 2: "Show All" control (AC: #2)
  - [x] Pill button `data-testid="debug-show-all-button"` appears in the panel header while filtered (with player tag of current filter); click → clear filter
  - [x] Header shows active filter state: "Showing P3 (challenger) only"
- [x] Task 3: Filtered log pipeline (AC: #1, #3)
  - [x] `filterLogsByPlayer(logs, playerId)` pure fn in `src/lib/replayLogs.ts` (extend 3.10's module) — applied BEFORE windowing so the ±1s window shows the filtered stream; filter applies during scrubbing automatically since both derive from `canvasStore.currentFrame` (AC #3 for free)
  - [x] Empty filtered state: "No logs from P3 within ±1s" (distinct from 3.10's empty states)
- [x] Task 4: Player → log affordance both directions (AC: #1)
  - [x] Pitch click → filter (Task 1); ALSO: clicking a player tag chip on a log entry selects that player on pitch (highlight + filter) — cheap symmetry, huge UX win (DevTools mental model from UX spec)
- [x] Task 5: Unit tests
  - [x] `filterLogsByPlayer` (match both, team+slot composite matching, empty result)
  - [x] Store: toggle semantics (select→filter on, re-select→filter off, Show All keeps selection), filter survives frame changes
- [x] Task 6: E2E (`practice-match.spec.ts`) (AC: #1-#3)
  - [x] Replay with two logging players → click P2 on pitch → only P2 entries visible + highlight on pitch; click P2 again → all logs; scrub while filtered → still only P2; "Show All" clears; click log chip P5 → P5 selected+filtered

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

euria-code (infomaniak/euria-code)

### Implementation Plan

**Key discovery:** replay sprites are built non-interactive (story 3.7: `interactive: false` → `eventMode 'none'`), so pitch clicks cannot select players in replay mode today — the story's assumption "clicking a player ALREADY emits PLAYER_SELECTED" does not hold yet. Bridge: extend `Game.onStagePointerDown` (the existing stage-level handler that already does empty-pitch deselection via `hitTestPlayer`) to emit `onPlayerSelected` when a replay is loaded and the hit-test finds a player. Tactic mode keeps its sprite-pointerdown path untouched (`matchFrames.length > 0` guard); no drag session is started for replay sprites (they stay non-interactive).

**Identity model:** `selectedPlayerId` in replay mode already IS the canonical composite `matchPlayerKey(team, slot)` (`challenger-3`). `logFilterPlayerId` follows the same convention (no new id shape). The reverse mapping needed for display labels (`matchPlayerFromKey`) lives in `teamMapping.ts` next to `matchPlayerKey` — the single translation point; no ad-hoc parsing elsewhere.

**Toggle semantics (one AppShell handler):** re-click on the already-selected player with logs → toggle the LOG FILTER, keep the pitch highlight (AC #2); re-click without logs (edit mode) → historical deselect toggle; empty-pitch click → clear selection AND filter ("Show All" clears only the filter). "Player has logs" = `replayLogs.some(matchPlayerKey(entry.team, entry.slot) === playerId)`.

**Pipeline order:** `filterLogsByPlayer` BEFORE `logsAroundTick` (Dev Notes) — both memos derive from `canvasStore.currentFrame`, so scrubbing keeps the filter for free (AC #3).

**E2E determinism:** the 3.11 script emits NO actions (log-only), so challenger players never leave their kickoff formation — pitch clicks target exact formation coordinates computed from `computePitchRect` math (FIELD_PADDING=40, 2:1 fit) over the canvas bounding box. Slots 1+5 run script A ("alpha"), slots 2-4 script B ("beta"). Pitch highlight is asserted through the existing sprite-census test seam (`data-selected-player` attribute on the canvas container, published by TacticsCanvas like `data-match-players`).

### Debug Log References

- RED→GREEN: new tests written first (17 failing), then implementation — `vitest run replay-logs team-mapping canvas-store` → 59/59, then full suite 484/484.
- E2E (chromium): `practice-match.spec.ts` 8/8 (incl. new 3.11 test and the updated 3.10 test); 3.10+3.11 re-run on firefox+webkit 4/4; workspace 53/55 and panel-layout 1 fail — all reproduce on the clean baseline (`git stash` verification), unrelated to this story (script-validation 422s, panel-strip persistence).

### Completion Notes List

- **Engine gap bridged:** replay sprites are non-interactive (3.7 decision), so "click a player on the pitch" did not emit anything in replay mode. `Game.onStagePointerDown` (which already owned empty-pitch deselection via `hitTestPlayer`) now also emits `onPlayerSelected` when a replay is loaded and a player is hit — selection only, never a drag session. Tactic mode is untouched (`matchFrames.length > 0` guard): its 53 workspace e2e interactions all still pass.
- **One canonical composite:** `logFilterPlayerId` reuses `matchPlayerKey(team, slot)` — the exact id shape `selectedPlayerId` already carries in replay mode. The reverse mapping for display labels (`matchPlayerFromKey`) lives in `teamMapping.ts` beside `matchPlayerKey`; it rejects tactic ids ('home-2'), the SYS sentinel (slot 0) and malformed keys. No ad-hoc parsing anywhere else.
- **Toggle semantics in ONE AppShell handler** (story directive): new click → select + filter-if-it-logged; re-click with logs → clear filter, keep highlight (AC #2); re-click without logs (edit mode) → historical deselect toggle; empty pitch → clear both; Show All → clear filter only. The store keeps `selectedPlayerId`/`logFilterPlayerId` orthogonal (unit-tested independence); the e2e asserts the composed semantics.
- **Filter → window order** implemented as the Dev Notes require: `filterLogsByPlayer` then `logsAroundTick`, both derived from `canvasStore.currentFrame` — scrubbing keeps the filter with no extra sync (AC #3), and a quiet player shows their own stream instead of a misleading empty window.
- **Chips are real buttons** (keyboard accessible, `data-testid="debug-log-entry-{i}-player-chip"`) — this required two locator updates inside the 3.10 e2e test (entry locator now excludes chips via `:not([data-testid$="-player-chip"])`; chip color asserted via the chip testid instead of `span`). The 3.10 test still passes on all three browsers.
- **Pitch highlight e2e seam:** the Pixi ring has no DOM, so TacticsCanvas republishes the engine's selection as `data-selected-player` next to the existing `data-match-players` census attributes — same established pattern, asserted in the e2e for every selection change.
- **E2E determinism trick:** the 3.11 scripts emit no actions, so challenger players never leave the fixture kickoff formation — pitch clicks target exact formation coordinates computed from the canvas box with the engine's pitch-rect math (FIELD_PADDING 40, 2:1 fit). Slots 1+5 log 'alpha', 2-4 log 'beta'.
- Empty-filtered state text: "No logs from P{n} within ±1s", shown only when a replay is loaded (3.10's "No replay loaded"/"This AI never logged" messages preserved).
- Pre-existing failures documented (not introduced here): 2 workspace script-validation 422s, 1 panel-layout persistence test, 4 lint warnings.

### Change Log

- 2026-09-16: Story 3.11 implemented — player-filtered debug logs. New: `canvasStore.logFilterPlayerId`/`setLogFilter`, `filterLogsByPlayer` (replayLogs), `matchPlayerFromKey` (teamMapping), replay pitch-click selection (Game stage hit-test), debugger filter indicator + Show All pill + clickable player chips, `data-selected-player` census seam, 17 unit tests + 1 e2e test.
- 2026-09-16: Code review (3 adversarial layers) — 8 patches applied: Watch roster now built from match frames in replay mode (decision: match players join selection + live states natively; tactic roster stays for edit mode), Back-to-editor clears the store selection (phantom-selection fix), hit-test resolves the visually-top sprite on overlap, filter indicator gains `role="status"` + chips `aria-pressed`, `matchPlayerFromKey` rejects non-canonical slots (digits-only, canonical-form check) with 7 new rejection cases, English-only comment fix, orphaned `toggleSelectedPlayer` removed (with its 3 unit tests), e2e chip-exclusion locator deduped into `LOG_ENTRY_SELECTOR`. 1 item deferred (AppShell toggle unit test — needs component-test infra). Verified: unit 481/481, tsc clean, lint 0 errors/4 pre-existing warnings, e2e practice-match chromium 8/8.

### File List

- src/stores/canvasStore.ts (modified — log filter state + action)
- src/lib/teamMapping.ts (modified — matchPlayerFromKey reverse mapping)
- src/lib/replayLogs.ts (modified — filterLogsByPlayer)
- src/components/canvas/engine/Game.ts (modified — replay pitch-click selection via stage hit-test)
- src/components/canvas/TacticsCanvas.tsx (modified — data-selected-player census seam)
- src/components/layout/AppShell.tsx (modified — selection→filter click handler, lifecycle clears)
- src/components/debugger/DebuggerPanel.tsx (modified — filtered pipeline, indicator, Show All, clickable chips, empty state)
- tests/unit/stores/canvas-store.test.ts (modified — 8 log-filter tests)
- tests/unit/lib/replay-logs.test.ts (modified — 6 filterLogsByPlayer tests)
- tests/unit/lib/team-mapping.test.ts (modified — 3 matchPlayerFromKey tests)
- tests/e2e/practice-match.spec.ts (modified — new 3.11 e2e test; 3.10 locators adapted to clickable chips)

### Review Findings

- [x] [Review][Patch] Watch list empties on replay pitch selection (id-vocabulary mismatch) [src/components/debugger/DebuggerPanel.tsx:52] — a replay click stores a match key (`challenger-2`) into `selectedPlayerId`, but the Watch roster is `rosterFromTactic` (`home-0`..`home-4`); `roster.filter(p => p.id === selectedPlayerId)` returns `[]` → all `debug-watch-row-*` rows disappear, `debug-watch-empty` shows "Aucun joueur à afficher" under the contradictory title "Watch (tous les joueurs)". **Decision (Pelo, 2026-09-16): in replay mode build the Watch roster from the 10 match players (challenger + opponent, live frame states join natively); keep the tactic roster in edit mode.**
- [x] [Review][Patch] Selection survives "Back to editor" → phantom selection [src/components/layout/AppShell.tsx:333] — `handleBackToEditor` clears the log filter but not `selectedPlayerId`; the engine wipes its internal selection on `loadTactic` (destroyAllPlayerSprites), so empty-pitch deselect can never fire (guard `selectedPlayerId !== null`), the Watch list stays empty in edit mode, and `data-selected-player` keeps a stale value with no engine ring.
- [x] [Review][Patch] Stage hit-test picks the bottom-most sprite on overlap [src/components/canvas/engine/Game.ts:673] — `hitTestPlayer` iterates the players Map in insertion order (= render order bottom→top), so when two replay sprites overlap the click resolves to the occluded player instead of the visually-top one.
- [x] [Review][Patch] Filter state invisible to assistive tech [src/components/debugger/DebuggerPanel.tsx:204] — the "Showing P{n} only" indicator is a bare `<span>` (no `role="status"`/`aria-live`) and player chips carry no `aria-pressed`, so screen readers never announce that the stream narrowed.
- [x] [Review][Patch] `matchPlayerFromKey` accepts non-canonical slot spellings [src/lib/teamMapping.ts:43] — `Number()` coercion admits `challenger-0x3`, `challenger-2.0`, `challenger- 3`, `challenger-1e1` (→ slot 10), contradicting the "returns null for garbage" contract; latent until a non-canonical producer (e.g. URL param) appears.
- [x] [Review][Patch] New French comment violates the story's English-only constraint [src/stores/canvasStore.ts:19] — the story 3.11 `logFilterPlayerId` comment was added in French.
- [x] [Review][Patch] `toggleSelectedPlayer` orphaned by this change [src/stores/canvasStore.ts:37] — the AppShell rewrite removed its last production call site; it now exists only for its own unit tests and its docstring ("clicking the selected player again deselects it") contradicts the new toggle semantics.
- [x] [Review][Patch] Chip-exclusion locator duplicated 3× [tests/e2e/practice-match.spec.ts:475] — the compound `:not([data-testid$="-player-chip"])` selector is copy-pasted; one shared const would pin the testid convention.
- [x] [Review][Defer] Re-click → filter-off toggle has no direct unit test [src/components/layout/AppShell.tsx:206] — the store test mirrors the AppShell logic by calling `setLogFilter(null)` directly; the real toggle branch is only exercised by e2e. Deferred, pre-existing (AppShell-level logic needs component-test infra).
