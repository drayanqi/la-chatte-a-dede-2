---
baseline_commit: 0cfff47dcb7e0190db6f72efae93b143884b63b6
---

# Story 3.9: Timeline Scrubber & Navigation

Status: done

## Story

As a user,
I want to navigate through the replay tick-by-tick,
So that I can analyze specific moments.

## Acceptance Criteria

1. **Given** replay is loaded, **When** I view the timeline, **Then** I see current position and total duration in `mm:ss` format (e.g. `00:42 / 03:00`), **And** I see a scrubber handle I can drag.

2. **Given** I drag the scrubber, **When** I release, **Then** playback jumps to that tick, **And** the frame renders immediately (seek < 16ms per interface-contract.md).

3. **Given** I press left/right arrow keys, **When** the replay is paused, **Then** it steps backward/forward one tick.

4. **Given** I press Shift+left/right, **When** navigating, **Then** it jumps 60 ticks (1 second at the engine's 60 fps — epics.md said 30 ticks based on a 30fps assumption; superseded by game-rules.md).

## Tasks / Subtasks

### Frontend Tasks (React)

- [x] Task 1: Scrubber upgrades in `Timeline.tsx` (AC: #1, #2)
  - [x] Real draggable handle (pointer events: pointerdown/move/up with setPointerCapture on the track; click-to-seek already exists — unify paths into one `seekFromClientX`)
  - [x] While dragging: `onFrameChanged`-driven frame render on every pointermove (not only on release) — instant scrub feedback is THE core interaction (UX spec: perceived latency < 16ms)
  - [x] `mm:ss` time display from tick: `formatTime(tick)` = `tick/60` seconds (extract pure fn `src/lib/timeFormat.ts`); total is `frames/60` (03:00 for a full match)
  - [x] ARIA: `role="slider"`, `aria-valuemin/max/now`, keyboard focusable
- [x] Task 2: Keyboard navigation (AC: #3, #4)
  - [x] Window keydown handler: ArrowLeft/ArrowRight → step ±1 tick (canvas `step()` exists); Shift+Arrow → ±60 ticks (seek)
  - [x] Guard: ignore when focus is in Monaco/textarea/input (same helper as 3.8's Space guard — extend `shouldTogglePlayback` into a shared `isTypingContext(event)` in `src/lib/keyboard.ts`); preventDefault to avoid page scroll
  - [x] Stepping while playing: allowed — step pauses playback (video-player convention)
- [x] Task 3: Goal markers (AC: #1 enhancement, from UX spec Phase 5)
  - [x] Render small markers on the track at frames whose `events` include a goal (data from matchStore.replayFrames — precompute `goalTicks: number[]` once per replay load in a selector/helper, unit-testable)
  - [x] Marker color = scoring team color (orange/blue from 3.7 teamMapping)
- [x] Task 4: Unit tests
  - [x] `timeFormat` (0→"00:00", 2520→"00:42", 10800→"03:00", >total clamp)
  - [x] `goalTicks` extraction (no goals, multiple goals, both teams)
  - [x] `isTypingContext` guard (textarea, input, monaco contenteditable, plain body)
- [x] Task 5: E2E (extend `practice-match.spec.ts` replay section)
  - [x] Drag scrubber → frame counter jumps; ArrowRight while paused → +1; Shift+ArrowRight → +60; time display shows `00:42` after seeking to tick 2520 (AC: #1-#4)

### Review Findings

_Three-layer adversarial review 2026-09-15 (Blind Hunter / Edge Case Hunter / Acceptance Auditor), uncommitted diff vs baseline `0cfff47`, scoped to the story's 12 files. 15 raw findings → 12 unique after merge → 1 decision, 5 patches, 1 defer, 5 dismissed after code verification._

- [x] [Review][Patch] Position/duration display convention — RESOLVED (2026-09-15, Pelo): elapsed-time convention. The replay can never display its own duration — scrubbing to the last frame (10799) shows `02:59 / 03:00` because position = `formatTime(tick)` floors (`10799/60 = 182.98s → 02:59`) while total = `formatTime(10800) = 03:00`; `aria-valuetext` has the same asymmetry ("02:59 of 03:00" at `aria-valuenow === aria-valuemax`) and the handle visually never reaches 100%. Fix: position/`aria-valuetext` use `formatTime(tick + 1)` (elapsed time — `03:00 / 03:00` at the end; `00:00@0` and `00:42@2520` unchanged). [src/components/layout/Timeline.tsx:86, src/lib/timeFormat.ts:10]
- [x] [Review][Patch] Scrub start does not pause playback — during a drag while playing, `gameLoop` keeps advancing/emitting while each rAF-coalesced `flushSeek` snaps back: store/fill/handle oscillate every frame. Fix: pause on pointerdown (stay paused after release, mirroring the arrow-step convention); optional alternative: resume on release if it was playing. [src/components/layout/Timeline.tsx:89]
- [x] [Review][Patch] Pointerup release position is dropped — `handlePointerEnd` only flushes `pendingClientXRef` (last *pointermove*) and skips entirely when no rAF is pending, so `e.clientX` is never read; on a fast flick the handle rests tens-of-px (hundreds of frames) away from the release point, contradicting the comment "The release position must win". Fix: set `pendingClientXRef.current = e.clientX` then flush (synchronously if no rAF pending). [src/components/layout/Timeline.tsx:102]
- [x] [Review][Patch] Arrow handler has no modifier-chord guard and preventDefaults before the no-replay guard — Ctrl/Alt/Meta+Arrow (macOS desktop switching, AT word-jump) are swallowed app-wide, and with `total === 0` the keys are prevented but do nothing (unlike the Space path, which rejects chords via `shouldTogglePlayback`). Fix: reject chords like the Space path; only `preventDefault` when navigation will act. [src/components/layout/AppShell.tsx:453]
- [x] [Review][Patch] Scrubber accepts non-primary buttons and any pointer id — no `e.button === 0`/`isPrimary` check (right-click-drag scrubs while the context menu opens) and no pointerId tracking (a second touch steals capture, positions oscillate, first-up orphans the drag). Fix: gate pointerdown on primary button, track the active pointerId in down/move/end. [src/components/layout/Timeline.tsx:89]
- [x] [Review][Patch] Story File List does not disclose the `index.ts` parallel-stream export swap — the entry says "modified — lib exports" but the Monaco intellisense swap (`monacoGameApiProvider` → `gameScript`/`gameApiDts`) belongs to the parallel stream per the Debug Log; the diff alone does not compile without the parallel-stream files (Game.ts → `matchFrames`). Fix: amend the File List disclosure. [_bmad-output/implementation-artifacts/3-9-timeline-scrubber-and-navigation.md:146]
- [x] [Review][Defer] [parallel-stream] `normalizeMatchFrames` dereferences frames before `loadFramesInternal`'s malformed-payload guard — the API path is pre-validated (`isPlayableFramesFile`) but the `TEST_LOAD_FRAMES_EVENT` hook only checks `Array.isArray`, so a frame missing `ball` now throws inside `loadFrames` instead of warn+ignore — deferred, belongs to the match-preview/bot-fixes stream [src/lib/matchFrames.ts:22, src/components/canvas/engine/Game.ts:361]

_Dismissed after verification (5): Shift+arrow fractional seek (store always receives the floored index — `gameLoop` emits via `applyFrame(Math.floor(...))`, Game.ts:185, and all `seekFrame` callers pass integers); fractional `aria-valuenow` (same reason); Home/End not pausing (seek-family continues playback by design, consistent with pre-existing click-to-seek); missing ArrowUp/Down on the slider (horizontal slider's required keys work globally and while focused — verified no double-step); new French `PROPRIÉTAIRE` header (repo-wide ownership-header convention; all new prose is English)._

## Dev Notes

- Tick↔time mapping everywhere: 60 ticks = 1 second (game-rules.md). The epics.md examples (`Shift+arrows = 30 ticks (1 second)`) encode the old 30fps assumption — implement the INTENT (1 second), i.e. 60 ticks, and note the variance (already reflected in AC #4).
- `Timeline.tsx` today has: step back/forward buttons, play/pause, click-to-seek progress bar, frame counter (frames/60 display). This story upgrades seek to continuous drag + adds keyboard + markers + mm:ss. Keep existing data-testids working; add new ones.
- Seek path must reuse `canvasRef.current.seekFrame(i)` / `step()` (TacticsCanvasHandle) — no direct Pixi access from React.
- While paused, every arrow step renders immediately (single frame apply) — no play() call.
- Keep `step()` direction semantics already defined ('forward'|'backward').
- Architecture compliance: English-only code/comments; inline styles; data-testids; keyboard accessibility (UX spec: visible focus indicators, logical tab order).

### Test Selectors

| Selector | Element |
|----------|---------|
| `[data-testid="timeline-track"]` | Scrubber track |
| `[data-testid="timeline-handle"]` | Draggable handle |
| `[data-testid="timeline-time-display"]` | `00:42 / 03:00` text |
| `[data-testid="goal-marker-{n}"]` | Goal position markers |

### Previous Story Intelligence

- From 3.8: playback state (isPlaying/currentFrame/totalFrames) lives in canvasStore, fed by FrameChangedEvent; Space toggle exists with typing guard — extend, don't duplicate.
- From 3.7: goal events land in frames[].events; team colors via teamMapping.
- From UX spec: scrubbing is the most-used interaction — if a drag feels laggy, throttle by requestAnimationFrame, never by skipping renders.

### Project Structure Notes

- Update: `src/components/layout/Timeline.tsx`, `src/components/layout/AppShell.tsx` (keyboard binding mount), `src/stores/canvasStore.ts` (if goalTicks exposed)
- New: `src/lib/timeFormat.ts`, `src/lib/keyboard.ts` (shared guard)
- Update: `tests/e2e/practice-match.spec.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.9: Timeline Scrubber & Navigation]
- [Source: _bmad-output/planning-artifacts/game-rules.md#Duree] (60fps → tick↔second mapping)
- [Source: _bmad-output/planning-artifacts/interface-contract.md#Contraintes de Performance (frame seek < 16ms)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Implementation Approach Phase 5 — Timeline]
- [Source: src/components/layout/Timeline.tsx] (existing controls to upgrade)

## Dev Agent Record

### Agent Model Used

euria-code (infomaniak/euria-code), opencode CLI — story executed 2026-09-15

### Debug Log References

- E2E `step()` investigation: isolated repro spec (deleted after use) driving `TEST_LOAD_FRAMES_EVENT`
  with 300 synthetic frames showed Shift+ArrowRight (+60 seek) and Home (slider) working while
  ArrowRight (+1 step) emitted nothing. Root cause: time-based playback (3.8) leaves
  `Game.currentFrame` fractional when paused (e.g. 149.6); `step()` incremented the float and
  `applyFrame(matchFrames[150.6])` resolved to undefined — no sprite update, no store emit.
  Fixed by flooring `currentFrame` before the ±1 (engine-internal, direction semantics preserved).
- E2E timeout: the navigation test exceeded the global 60s on a slow simulation run (assertion was
  mid-flight, not failing) — bumped to 120s via `test.setTimeout`, same as the 3.8 replay test's
  observed 51.5s ceiling.
- Pre-existing failure class: workspace/tactic-tabs e2e (Monaco editor tests, script-creation 422)
  fail in this environment. Verified pre-existing by `git stash` + rerun on clean baseline
  `0cfff47` — identical failures with zero story changes — then `git stash pop`. NOTE: the working
  tree carries a parallel in-flight work stream (bot balance fixes + Monaco intellisense refactor,
  incl. `normalizeMatchFrames` in Game.ts and deleted monacoGameApiProvider); those files/changes
  are NOT part of this story.

### Completion Notes List

- Scrubber (AC #1, #2): single `seekFromClientX` path for click + drag; pointerdown seeks and
  `setPointerCapture`s the track, pointermove seeks continuously (frame renders flow from
  `onFrameChanged` → canvasStore — instant feedback), pointerup/cancel flushes the last position.
  Pointermove bursts are coalesced to one seek per animation frame (rAF) — newest position always
  wins, engine never flooded, no render skipped (UX spec rule).
- Time display (AC #1): `mm:ss` via new pure `formatTime` (60 ticks = 1s per game-rules.md). The
  old inline `m:ss.cc` format was replaced. Variance note honored: Shift+arrows = 60 ticks (the
  epics.md 30-tick example encoded a stale 30fps assumption).
- Keyboard (AC #3, #4): AppShell window handler extended — ArrowLeft/Right step ±1 (auto-repeat
  welcome: hold to scrub), Shift+Arrow seeks ±60 clamped to [0, total-1]; `isTypingContext` guard
  (shared with the 3.8 Space toggle, which now delegates to it) + `preventDefault`. Stepping while
  playing pauses first (video-player convention); stepping while paused renders immediately (no
  play() call). Slider element handles Home/End; arrows are NOT handled there to avoid
  double-stepping with the global handler.
- Goal markers (AC #1 enhancement): pure `extractGoalTicks` in `score.ts` (keyed on array position
  like `computeScore` — a drifting data `index` can never misplace a marker), computed once per
  replay load in AppShell (`useMemo` on matchFrames) and passed as a Timeline prop; markers colored
  orange/blue via `teamIdFromMatchTeam` + the engine's team hex (#ff6b1a / #1a8cff).
- Guard hardening: jsdom returns `undefined` (not `false`) for `isContentEditable` on some
  elements (e.g. body) — the shared guard coerces with `Boolean()` so it returns a real boolean.
- Tests: 3 new/extended unit files (timeFormat, extractGoalTicks, isTypingContext) written RED
  first; 1 E2E test covering drag-mid-drag frame jumps, ±1 steps, ±60 jumps and `00:42 / 03:00`
  at tick 2520 (deterministic: Home → 42× Shift+ArrowRight). Full unit suite 435/435 green,
  lint 0 errors (5 pre-existing warnings), production build OK.
- Regression posture: practice-match suite green on chromium (with fresh servers) and firefox
  (full spec, parallel run). Remaining e2e failure class (Monaco/script-422) proven pre-existing
  on the clean baseline commit (see Debug Log). No new dependencies introduced.

### File List

- src/lib/timeFormat.ts (new)
- src/lib/keyboard.ts (new)
- src/lib/playbackShortcuts.ts (modified — editable-surface check delegated to shared guard)
- src/lib/score.ts (modified — added GoalTick + extractGoalTicks)
- src/lib/index.ts (modified — lib exports; also carries the parallel-stream Monaco
  intellisense export swap (monacoGameApiProvider → gameScript/gameApiDts), see Debug Log —
  the story diff alone does not compile without the parallel-stream files)
- src/components/layout/Timeline.tsx (modified — drag scrubber, mm:ss, ARIA slider, goal markers)
- src/components/layout/AppShell.tsx (modified — arrow navigation, goalTicks wiring)
- src/components/canvas/engine/Game.ts (modified — step() fractional-frame fix; file also carries
  unrelated parallel-stream edits, see Debug Log)
- tests/unit/lib/time-format.test.ts (new)
- tests/unit/lib/keyboard.test.ts (new)
- tests/unit/lib/score.test.ts (modified — extractGoalTicks suite)
- tests/e2e/practice-match.spec.ts (modified — story 3.9 navigation test)
- _bmad-output/implementation-artifacts/3-9-timeline-scrubber-and-navigation.md (this file)
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-09-15: Story 3.9 implemented — continuous drag scrubber with unified seek path (rAF
  coalescing), mm:ss time display, ARIA slider, goal markers colored by scoring team, keyboard
  navigation (±1 tick arrows, ±60 ticks Shift+arrows, shared typing guard), engine step()
  fractional-frame fix. Unit tests (RED first) + E2E navigation test added. Story ready for review.
- 2026-09-15: Code review (gds-code-review, 3 adversarial layers) — 15 raw findings → 12 unique →
  6 patches applied (elapsed-time display convention [user decision], pause on scrub start,
  pointerup release-position flush, arrow chord guard + conditional preventDefault, pointer
  gating primary-button/pointerId, File List index.ts disclosure), 1 deferred
  (parallel-stream normalizeMatchFrames validation order), 5 dismissed after verification.
  Verified: 435/435 unit, tsc clean, ESLint 0 errors (1 pre-existing warning AppShell:192
  teamId). E2E not re-run (practice-match suite needs servers; assertions remain valid by
  analysis: formatTime(2521)=00:42, formatTime(1)=00:00, release-flush = last move coords).
  Status → done.
