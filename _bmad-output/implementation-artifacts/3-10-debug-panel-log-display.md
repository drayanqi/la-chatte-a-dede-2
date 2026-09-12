# Story 3.10: Debug Panel — Log Display

Status: ready-for-dev

## Story

As a user,
I want to see console.log output from my AI,
So that I can understand what my code is doing.

## Acceptance Criteria

1. **Given** my AI uses console.log, **When** I watch the replay, **Then** I see log entries in the debug panel, **And** each entry shows: tick number, player ID, message.

2. **Given** multiple players log messages, **When** I view the debug panel, **Then** logs are color-coded by player (matching pitch colors), **And** I can distinguish which player logged what.

3. **Given** replay is at tick N, **When** I view the debug panel, **Then** logs are scrolled to show entries around tick N.

## Tasks / Subtasks

### Frontend Tasks (React)

- [ ] Task 1: Log extraction helper `src/lib/replayLogs.ts` (AC: #1)
  - [ ] `extractLogs(frames)` → flat indexed array `{tick, team, slot, level, message}` from every frame's `logs[]` (format from 3.4), computed ONCE per replay load and memoized in matchStore (do not rescan 10800 frames per render)
  - [ ] `logsAroundTick(logs, tick, windowTicks=60)` → slice of entries within ±1s window around current tick (pure, unit-tested) — this is the AC #3 windowing mechanism; full virtual scrolling is overkill for a 1s window
  - [ ] Levels: engine `log` → normal, `warn` → `--warning #dcdcaa`, `error` → `--error #f14c4c`
- [ ] Task 2: Rewrite `DebuggerPanel.tsx` log section (AC: #1, #2, #3)
  - [ ] Replace the fake/hardcoded console output (panel is UI-only today) with real frame logs from `logsAroundTick(canvasStore.currentFrame)` + filter state (3.11 adds filtering; keep this story showing all)
  - [ ] Entry layout (monospace 12px `--text-sm`): `#tick` (muted) | player tag `P{slot}` (team color chip: challenger orange / opponent blue per teamMapping) | message
  - [ ] Auto-scroll to keep the current-tick window in view on FrameChangedEvent; manual scroll disables auto-follow until user clicks "Follow replay" pill (standard console UX)
  - [ ] Empty states: "No logs this tick (showing ±1s)" and "This AI never logged" (distinction matters for debugging)
  - [ ] Remove the panel's placeholder start/stop debugging + breakpoints/watch sections for now (no execution backend exists — they were Epic-2 scaffolding; keep component focused on log display; breakpoints return in a future epic) — remove related debuggerStore UI wiring only if unreferenced after refactor
- [ ] Task 3: Panel visibility during replay (UX spec: "Debug panel always visible during replay")
  - [ ] When replay mode active (matchStore.replayFrames non-null), debug panel shows logs automatically — no manual "start debugging" step
  - [ ] Warnings/errors from 3.4 (MULTIPLE_ACTIONS etc.) render with warn/error styling and a type badge so users can spot them (this is the "Aha" engine)
- [ ] Task 4: Unit tests
  - [ ] `extractLogs` (multi-tick, multi-player, levels preserved, empty frames)
  - [ ] `logsAroundTick` (window edges, all-before / all-after cases, empty log set)
  - [ ] Panel rendering tests: entry content, color class per team, level styling, follow-mode toggle

### Testing Tasks (E2E)

- [ ] Task 5: Extend `practice-match.spec.ts` (AC: #1-#3)
  - [ ] Play a match with a script containing `console.log('pos', me.position.x)` → open replay → panel shows entries with tick + P-tag + message; scrubbing moves the window (assert a specific tick's entry visible after seeking); warn entries styled (test AI with double-action script)

## Dev Notes

- **Data source:** frame `logs: [{team, slot, level, type, message}]` was ADDED to the engine frame contract in Story 3.4 (variance over backend-architecture.md's frame format, which has no logs — that variance is intentional and load-bearing for FR36-39). If the engine field is missing, panel shows empty state, never crashes.
- Log volume reality check: worst case (10 players × 1 log × 10800 ticks = 108K entries) — this is why extraction is once-per-load and display is windowed to ±60 ticks around the playhead. A flat "render everything" list WILL die at 10800 entries; windowing is the required design, not an optimization.
- Player identity: use `slot` + team for the chip (P1…P5 per team, color-coded). "Player ID" in the AC = slot+team (engine's identity model from 3.4). Correlate visually with pitch player numbers.
- The console.log→panel correlation must survive scrubbing (3.9) — follow-the-playhead behavior comes free via `logsAroundTick(canvasStore.currentFrame)`.
- Do NOT implement click-to-filter here (3.11) but DO structure the panel so a filter state can slot in (3.11 owns it).
- Architecture compliance: English-only code/comments, TypeScript strict, inline styles, data-testids, monospace font for logs (UX spec `--font-mono`).

### Test Selectors

| Selector | Element |
|----------|---------|
| `[data-testid="debug-log-panel"]` | Panel container |
| `[data-testid="debug-log-entry-{i}"]` | Log entry rows |
| `[data-testid="debug-log-empty"]` | Empty state |
| `[data-testid="debug-follow-pill"]` | Follow replay toggle |

### Previous Story Intelligence

- From 3.4: logs recorded per tick per player with `level`; warnings taxonomy (`MULTIPLE_ACTIONS`, `DRIBBLE_NO_BALL`, `SHOOT_NO_BALL`) and errors (`SCRIPT_TIMEOUT`, `SCRIPT_ERROR`) — render them distinctly (this is the product's core "understanding" value).
- From 3.8/3.9: canvasStore.currentFrame is the single playhead source; memoize extraction on replayFrames identity.
- From deferred-work.md: Monaco bundle decision unrelated; debuggerStore today has consoleOutput/breakpoints scaffolding — clean up what becomes dead code, keep store tests passing or updated.
- Existing `DebuggerPanel.tsx` shows selected-player info (canvasStore.selectedPlayerId) — that section STAYS (3.11 builds on it).

### Project Structure Notes

- New: `src/lib/replayLogs.ts`
- Update: `src/components/debugger/DebuggerPanel.tsx`, `src/stores/matchStore.ts` (memoized logs), possibly `src/stores/debuggerStore.ts` (prune dead scaffolding), barrels
- Update: `tests/e2e/practice-match.spec.ts`, `tests/unit/stores/debugger-store.test.ts` (if store changed), new `tests/unit/lib/replay-logs.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.10: Debug Panel - Log Display]
- [Source: _bmad-output/planning-artifacts/script-ia-api.md#Gestion des Erreurs et Warnings] (levels/types)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Phase 4 — Debug Panel + Virtual scrolling note]
- [Source: src/components/debugger/DebuggerPanel.tsx] (placeholder panel being rewritten)
- [Source: _bmad-output/implementation-artifacts/3-4-script-sandboxing-and-execution.md] (frame logs contract)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
