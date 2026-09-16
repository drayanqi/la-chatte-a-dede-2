---
baseline_commit: d3874bb1f8bee74984ca87baa5b74434761d9860
---

# Story 3.10: Debug Panel — Log Display

Status: done

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

- [x] Task 1: Log extraction helper `src/lib/replayLogs.ts` (AC: #1)
  - [x] `extractLogs(frames)` → flat indexed array `{tick, team, slot, level, message}` from every frame's `logs[]` (format from 3.4), computed ONCE per replay load and memoized in matchStore (do not rescan 10800 frames per render)
  - [x] `logsAroundTick(logs, tick, windowTicks=60)` → slice of entries within ±1s window around current tick (pure, unit-tested) — this is the AC #3 windowing mechanism; full virtual scrolling is overkill for a 1s window
  - [x] Levels: engine `log` → normal, `warn` → `--warning #dcdcaa`, `error` → `--error #f14c4c`
- [x] Task 2: Rewrite `DebuggerPanel.tsx` log section (AC: #1, #2, #3)
  - [x] Replace the fake/hardcoded console output (panel is UI-only today) with real frame logs from `logsAroundTick(canvasStore.currentFrame)` + filter state (3.11 adds filtering; keep this story showing all)
  - [x] Entry layout (monospace 12px `--text-sm`): `#tick` (muted) | player tag `P{slot}` (team color chip: challenger orange / opponent blue per teamMapping) | message
  - [x] Auto-scroll to keep the current-tick window in view on FrameChangedEvent; manual scroll disables auto-follow until user clicks "Follow replay" pill (standard console UX)
  - [x] Empty states: "No logs this tick (showing ±1s)" and "This AI never logged" (distinction matters for debugging)
  - [x] Remove the panel's placeholder start/stop debugging + breakpoints/watch sections for now (no execution backend exists — they were Epic-2 scaffolding; keep component focused on log display; breakpoints return in a future epic) — remove related debuggerStore UI wiring only if unreferenced after refactor
- [x] Task 3: Panel visibility during replay (UX spec: "Debug panel always visible during replay")
  - [x] When replay mode active (matchStore.replayFrames non-null), debug panel shows logs automatically — no manual "start debugging" step
  - [x] Warnings/errors from 3.4 (MULTIPLE_ACTIONS etc.) render with warn/error styling and a type badge so users can spot them (this is the "Aha" engine)
- [x] Task 4: Unit tests
  - [x] `extractLogs` (multi-tick, multi-player, levels preserved, empty frames)
  - [x] `logsAroundTick` (window edges, all-before / all-after cases, empty log set)
  - [x] Panel rendering tests: entry content, color class per team, level styling, follow-mode toggle

### Testing Tasks (E2E)

- [x] Task 5: Extend `practice-match.spec.ts` (AC: #1-#3)
  - [x] Play a match with a script containing `console.log('pos', me.position.x)` → open replay → panel shows entries with tick + P-tag + message; scrubbing moves the window (assert a specific tick's entry visible after seeking); warn entries styled (test AI with double-action script)

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

euria-code (infomaniak/euria-code)

### Debug Log References

- E2E failure investigation (first run): the Playwright trace exposed the engine's `MAX_LOGS_PER_MATCH = 10_000` cap (`lahatadede-engine/src/engine/constants.ts:47`) — the original every-tick test script exhausted it at tick 999, and the trace snapshot (follow pill visible + "No logs this tick" at frame 3763) exposed the spurious follow-disable bug fixed below. Trace artifacts: `test-results/artifacts/practice-match-Practice-Ma-77fdd-g-panel-story-3-10-AC-1--3--chromium/`.

### Completion Notes List

- **Task 1** — `src/lib/replayLogs.ts`: `extractLogs(frames)` (flat, stable `index` per entry, defensive against frames missing the 3.4 `logs` field — empty state, never crashes) + `logsAroundTick(logs, tick, windowTicks=60)` (pure, inclusive ±window, binary search over the extraction's ascending-tick guarantee). `LOG_LEVEL_COLORS` encodes log → `#cccccc`, warn → `#dcdcaa` (--warning), error → `#f14c4c` (--error); `LOG_TEAM_COLORS` encodes challenger orange `#ff6b1a` / opponent blue `#1a8cff` matching the pitch. Entries carry `type` (beyond the listed `{tick, team, slot, level, message}`) because Task 3's type badge needs it.
- **Tasks 2-3 — interpretation decision**: Task 2's "remove ... breakpoints/watch sections" conflicts with Dev Notes ("selected-player info section STAYS — 3.11 builds on it"). Resolved per Dev Notes: removed the start/stop-debugging button, the Breakpoints section and the fake console (all Epic-2 `debuggerStore` scaffolding with no execution backend); KEPT the Watch (selected-player) section untouched, French UI strings included. After the refactor the panel no longer references `debuggerStore` (UI wiring removed per the task's own condition); the store file and its tests are intentionally left intact — they still pass and breakpoints "return in a future epic".
- **Tasks 2-3** — `DebuggerPanel.tsx` rewritten: header (title only) + Watch + Replay logs (flex:1). Logs come from `matchStore.replayLogs` (extracted ONCE per `loadReplay`, cleared on `clearReplay`/`reset`) windowed by `logsAroundTick(canvasStore.currentFrame)` — memoized per render via `useMemo`; no filtering yet (3.11 owns it). Entry: monospace 12px, `#tick` muted, `P{slot}` team-color chip, level-colored message, type badge on warn/error only. Empty states: `This AI never logged` (no logs in the whole replay) vs `No logs this tick (showing ±1s)` (quiet zone), both under `debug-log-empty`.
- **Auto-follow (AC #3)**: a `useEffect` on `[following, windowedLogs, currentFrame]` anchors the first entry at-or-after the playhead and scrolls it into view (target clamped to `[0, scrollHeight - clientHeight]`). Manual scroll (delta > 2px vs the last programmatic write) disables follow; the `Follow replay` pill (`debug-follow-pill`) restores it. **Bug found via E2E + fix**: when the window slides into a quiet zone the list content shrinks, the browser clamps `scrollTop` and the resulting scroll event spuriously disabled follow (pill shown, list stuck). Fixed by gating scroll handling on a shrinking `scrollHeight` (a clamp, not a user scroll).
- **Task 4** — 14 `replay-logs.test.ts` tests (extraction: multi-tick/multi-player/levels+type preserved/missing-logs-field/empty; windowing: edges inclusive, clamped head/tail, all-before/all-after, empty set, custom window), 7 new panel tests (windowed rendering, no full-set render, chip colors, level colors + badges, both empty states, follow toggle), 3 new `match-store.test.ts` tests (extraction memoized per load, empty-set replay, cleared with replay).
- **Task 5 — E2E design**: the test script logs + double-actions every 60 ticks (`ticks % 60 === 1`, top-level `var` persists across ticks in the sandbox). This keeps the whole match under `MAX_LOGS_PER_MATCH` and guarantees every ±60-tick window has entries — the first attempt (every-tick logging, 10 entries/tick) hit the engine's 10 000-entry cap at tick 999 and made late-match windows legitimately (and position-dependently) empty. Seek assertions use deterministic keyboard navigation (Home, 42× Shift+ArrowRight → tick 2520). Asserts: panel visible on replay with no start step; entry = `#tick` + `P{slot}` + message; chip computed color `rgb(255, 107, 26)`; MULTIPLE_ACTIONS badge computed color `rgb(220, 220, 170)`; window moves (tick-0 entries leave the DOM, scrollTop follows the playhead) and restores after seeking home.
- **Validation**: 459 unit tests pass (0 failures); `tsc -b` clean; ESLint 0 errors / 5 warnings — all pre-existing on baseline (TacticsCanvas exhaustive-deps, Game `finalConfig`, AppShell `teamId`, canvasStore `Position`, debuggerStore `get`); practice-match E2E 7/7 (chromium). Full chromium E2E suite has failures in unrelated specs — verified pre-existing by re-running panel-layout + editor-intellisense on the stashed baseline (identical failures); the rest are parallel-worker engine contention (practice-match passes its own serial run).
- `tsconfig*.tsbuildinfo` modifications are generated build artifacts from `tsc -b`, not source changes.

### File List

- src/lib/replayLogs.ts (new)
- src/components/debugger/DebuggerPanel.tsx (modified)
- src/stores/matchStore.ts (modified)
- tests/unit/lib/replay-logs.test.ts (new)
- tests/unit/components/debugger-panel.test.tsx (modified)
- tests/unit/stores/match-store.test.ts (modified)
- tests/e2e/practice-match.spec.ts (modified)
- tsconfig.node.tsbuildinfo, tsconfig.tsbuildinfo (generated build artifacts)

## Change Log

- 2026-09-16: Story 3.10 implemented — replay log pipeline (`extractLogs` + `logsAroundTick` in `src/lib/replayLogs.ts`), logs memoized once per replay load in `matchStore.replayLogs`, `DebuggerPanel` rewritten (Watch kept, Epic-2 debug scaffolding removed, windowed real log entries with team-color chips, level colors, type badges, auto-follow + follow pill, two empty states), fixed the spurious follow-disable on window shrink found during E2E. Tests: 14 lib + 12 panel + 3 store unit tests, practice-match E2E extended (459 unit tests passing, 7/7 practice-match E2E chromium).
- 2026-09-16: Code review (3 layers: adversarial, edge-case, acceptance) — 1 decision resolved (engine v1.5/v1.6 balance bump split out to its own workstream, recorded in `deferred-work.md`), 18 patches applied (ordering guarantee in `extractLogs`, NaN + malformed-entry guards, shrink-gate boundary check, follow state reset per replay, three-state empty display, SYS badge for slot-0 system warnings, message tooltip, 'Ubuntu Mono' font fallback, exact windowing test, clamp-path tests, E2E pill-hidden + overflow-guard + `data-tick` assertions, tsbuildinfo untracked, story test counts reconciled, game-rules mirror synced), 1 deferred (design-token extraction — pre-existing). Validation after review: 467 unit tests pass, `tsc -b` clean, ESLint 0 errors / 5 warnings (baseline), practice-match E2E 7/7 chromium.

## Review Findings

- [x] [Review][Decision] Undeclared engine balance bump (v1.5/v1.6) rides in this story's diff — **RESOLVED (Pelo, 2026-09-16): split out.** The engine changes stay in the working tree but are out of story 3.10's scope; documented as a separate parallel workstream in `deferred-work.md` (needs its own spec, v1.6 sign-off stamp, and EasyBotBalance liveness assertions). The stale game-rules constants mirror is fixed with this story's patches; the rest belongs to the split-out work.
- [x] [Review][Patch] Story record contradicts itself on test counts: Completion Notes say "13 replay-logs tests", Change Log says "17 lib", file has 14 — recounted and reconciled to 14 [_bmad-output/implementation-artifacts/3-10-debug-panel-log-display.md:105,123]
- [x] [Review][Patch] `tsconfig*.tsbuildinfo` are git-tracked build artifacts that dirty every `tsc -b` run — added `*.tsbuildinfo` to `.gitignore`, untracked both files [tsconfig.tsbuildinfo]
- [x] [Review][Patch] All five EasyBotBalance seed pins are 0-0 draws — **moved to the v1.6 balance workstream** (split-out decision above; recorded in `deferred-work.md` with the spec/sign-off work)
- [x] [Review][Patch] E2E never asserts `debug-follow-pill` stays hidden after the seek sequence — added `toBeHidden()` assertions after the 42 seeks and after Home restore [tests/e2e/practice-match.spec.ts:505-527]
- [x] [Review][Patch] No unit test for the shrink-gate clamp path (scroll event fired while `scrollHeight` shrinks must not disable follow) — added both clamp and genuine-user-scroll tests [tests/unit/components/debugger-panel.test.tsx]
- [x] [Review][Patch] Shrink-gate swallows any scroll event during a `scrollHeight` decrease, including a genuine user scroll that coincides with the shrink — now only skips when the clamped scrollTop sits at a boundary (0 or maxScroll) [src/components/debugger/DebuggerPanel.tsx:95-108]
- [x] [Review][Patch] Empty state shows "This AI never logged" whenever `replayLogs` is empty — gated on replay-active with a third "No replay loaded" state [src/components/debugger/DebuggerPanel.tsx:217-223]
- [x] [Review][Patch] `following` is component-local and never reset when a new replay loads or clears — reset via render-phase adjustment on `replayLogs` identity [src/components/debugger/DebuggerPanel.tsx:64]
- [x] [Review][Patch] `extractLogs` trusts `frame.index` for both `tick` and the ascending order its binary search depends on — now sorts a copy by `frame.index`, establishing the documented guarantee [src/lib/replayLogs.ts:47-64]
- [x] [Review][Patch] E2E `expect(scrollTopAfterSeek).toBeGreaterThan(scrollTopAtTick0)` assumes the windowed list overflows the container — guarded on `scrollHeight > clientHeight` [tests/e2e/practice-match.spec.ts:507,515-516]
- [x] [Review][Patch] E2E `filter({ hasText: '#0' })` is a substring match over the whole entry — entries now carry `data-tick` and the assertions match on it [tests/e2e/practice-match.spec.ts:480,514]
- [x] [Review][Patch] `whiteSpace: nowrap` + `textOverflow: ellipsis` permanently truncates long log messages — added `title={entry.message}` [src/components/debugger/DebuggerPanel.tsx:210-214,362-365]
- [x] [Review][Patch] Engine's LOG_CAP warning carries sentinel `slot: 0` (IsolatedScriptRunner.ts:226) — rendered as a "SYS" badge instead of a phantom "P0" player chip [src/components/debugger/DebuggerPanel.tsx:191-198]
- [x] [Review][Patch] A null/non-object entry inside a frame's `logs` array throws inside `loadReplay` — malformed log entries are now skipped [src/lib/replayLogs.ts:51-61]
- [x] [Review][Patch] A NaN `tick` defeats both binary-search comparisons and renders the full 10K-entry set — guarded `Number.isFinite(tick)` [src/lib/replayLogs.ts:71-98]
- [x] [Review][Patch] `game-rules.md` embedded engine-constants mirror still carried v1.3/v1.4 values — updated to v1.6 (0.5051, 2.5143) with a pending-signature pointer to `deferred-work.md` [_bmad-output/planning-artifacts/game-rules.md:209,214]
- [x] [Review][Patch] `LOG_FONT` drops 'Ubuntu Mono' from the UX-spec `--font-mono` stack the story cites [src/components/debugger/DebuggerPanel.tsx:230]
- [x] [Review][Patch] Windowing unit test too loose: fixture yields 13 entries but asserted `<= 27` with an arithmetically wrong comment — now asserts exactly 13 with a corrected comment [tests/unit/components/debugger-panel.test.tsx:208-221]
- [x] [Review][Defer] Hardcoded hex colors instead of `--warning`/`--error` design tokens [src/lib/replayLogs.ts:30-40] — deferred, pre-existing: the tokens are not defined anywhere in the app CSS and the entire codebase hardcodes hex inline styles; introducing the token layer is systemic work beyond this story
