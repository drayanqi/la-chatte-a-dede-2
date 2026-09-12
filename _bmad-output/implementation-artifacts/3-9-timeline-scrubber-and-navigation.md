# Story 3.9: Timeline Scrubber & Navigation

Status: ready-for-dev

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

- [ ] Task 1: Scrubber upgrades in `Timeline.tsx` (AC: #1, #2)
  - [ ] Real draggable handle (pointer events: pointerdown/move/up with setPointerCapture on the track; click-to-seek already exists — unify paths into one `seekFromClientX`)
  - [ ] While dragging: `onFrameChanged`-driven frame render on every pointermove (not only on release) — instant scrub feedback is THE core interaction (UX spec: perceived latency < 16ms)
  - [ ] `mm:ss` time display from tick: `formatTime(tick)` = `tick/60` seconds (extract pure fn `src/lib/timeFormat.ts`); total is `frames/60` (03:00 for a full match)
  - [ ] ARIA: `role="slider"`, `aria-valuemin/max/now`, keyboard focusable
- [ ] Task 2: Keyboard navigation (AC: #3, #4)
  - [ ] Window keydown handler: ArrowLeft/ArrowRight → step ±1 tick (canvas `step()` exists); Shift+Arrow → ±60 ticks (seek)
  - [ ] Guard: ignore when focus is in Monaco/textarea/input (same helper as 3.8's Space guard — extend `shouldTogglePlayback` into a shared `isTypingContext(event)` in `src/lib/keyboard.ts`); preventDefault to avoid page scroll
  - [ ] Stepping while playing: allowed — step pauses playback (video-player convention)
- [ ] Task 3: Goal markers (AC: #1 enhancement, from UX spec Phase 5)
  - [ ] Render small markers on the track at frames whose `events` include a goal (data from matchStore.replayFrames — precompute `goalTicks: number[]` once per replay load in a selector/helper, unit-testable)
  - [ ] Marker color = scoring team color (orange/blue from 3.7 teamMapping)
- [ ] Task 4: Unit tests
  - [ ] `timeFormat` (0→"00:00", 2520→"00:42", 10800→"03:00", >total clamp)
  - [ ] `goalTicks` extraction (no goals, multiple goals, both teams)
  - [ ] `isTypingContext` guard (textarea, input, monaco contenteditable, plain body)
- [ ] Task 5: E2E (extend `practice-match.spec.ts` replay section)
  - [ ] Drag scrubber → frame counter jumps; ArrowRight while paused → +1; Shift+ArrowRight → +60; time display shows `00:42` after seeking to tick 2520 (AC: #1-#4)

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

### Debug Log References

### Completion Notes List

### File List
