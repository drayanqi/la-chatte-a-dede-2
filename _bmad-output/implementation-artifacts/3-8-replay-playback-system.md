# Story 3.8: Replay Playback System

Status: ready-for-dev

## Story

As a user,
I want to watch match replays,
So that I can analyze what happened.

## Acceptance Criteria

1. **Given** a completed match, **When** I click "Watch Replay", **Then** the match loads and begins playback, **And** frames render at smooth 60 fps (NFR3).

2. **Given** replay is playing, **When** I click pause, **Then** playback stops at current frame, **And** I can click play to resume.

3. **Given** replay is playing, **When** I press Space, **Then** playback toggles pause/play.

4. **Given** a match has ended, **When** I watch replay, **Then** I can view my most recent match (auto-select newest completed match).

## Tasks / Subtasks

### Engine Tasks

- [ ] Task 1: Frame data source swap in `Game.ts`
  - [ ] `Game.loadFrames(frames)` (built in 3.7) becomes THE data source; retire the canned sine-wave generator (`runSimulation` at Game.ts:202) — keep the public `runSimulation()` handle API but reimplement it as a no-op/deprecation path so TacticsCanvasHandle stays stable (frontend callers removed in Task 3)
  - [ ] Autoplay on load: `play()` from frame 0; loop off (stop at last frame, show final score)
  - [ ] 60fps playback via Pixi ticker: advance currentFrame by delta-time × 60 (time-based, not per-tick, so playback speed is correct regardless of render rate)

### Frontend Tasks (React)

- [ ] Task 2: Replay loading in `matchStore`
  - [ ] `loadReplay(matchId)`: GET `/api/matches/{id}/frames` via apiClient → parse JSON (~5-8MB, parse once, keep in store) → set `replayFrames`, `replayMatch`; states: `isReplayLoading`, `replayError`
  - [ ] `fetchLatestMatch()` → GET /api/matches (first completed match) for AC #4
  - [ ] Memory guard: releasing previous replay when loading a new one; do NOT retain frames in more than one store slice
- [ ] Task 3: AppShell wiring (AC: #1, #4)
  - [ ] "Watch Replay" button (from 3.5 result banner) → `loadReplay(lastMatch.id)` → on success `canvasRef.current.loadFrames(frames)` + autoplay; show `data-testid="replay-loading-overlay"` with "Loading replay..." while fetching
  - [ ] On workspace mount: if a completed match exists, show a subtle "Watch last match" entry (AC #4 — most recent match reachable in 1 click); do NOT auto-open the viewer
  - [ ] Replace the 3.2-era demo tactic flow: once frames load, canvas shows the match; returning to edit mode re-loads the user tactic (`loadTactic`) — add explicit "Back to editor" control `data-testid="back-to-editor-button"`
- [ ] Task 4: Playback controls (AC: #2, #3)
  - [ ] Extend existing `Timeline.tsx` play/pause wiring to canvasStore-backed state (isPlaying already exists); Space keydown toggles play/pause — MUST ignore keystrokes originating from Monaco textarea (check `document.activeElement` tag/isContentEditable) so editing stays unaffected
  - [ ] Pause/resume keeps exact current frame; play state survives seek (paused stays paused)
- [ ] Task 5: Unit tests
  - [ ] matchStore: loadReplay success/error/loading, latest-match selection, frames released on reload
  - [ ] Space-toggle helper (extracted pure function `shouldTogglePlayback(event)` — testable without Monaco)

### Testing Tasks (E2E)

- [ ] Task 6: Revive replay section of `tests/e2e/practice-match.spec.ts` (AC: #1-#4)
  - [ ] Full loop: register → 5-slot lineup → Test vs Bot → Watch Replay → canvas visible with players/ball → autoplay advances frames (assert frame counter increases) → pause freezes counter → Space resumes → reload page → "Watch last match" opens most recent replay

## Dev Notes

- **Data flow** (backend-architecture.md "Flux de Replay"): React GET /api/matches/{id}/frames → Laravel streams the engine's JSON file → PixiJS replays frame-by-frame. Frame file ≈ 10800 frames / ~5-8MB — fetch+parse in one shot; show loading state; no streaming/paging needed for MVP.
- This story DELETES the canned simulation from Game.ts (3.7 added the real pipeline without touching it). Any test relying on `runSimulation()` generating 300 wiggle frames must be updated/removed.
- Playback is time-based: use Pixi `ticker.deltaMS` → `currentFrame += deltaMS/1000*60`, clamped to [0, totalFrames-1]. Never assume the ticker runs at exactly 60fps.
- The existing `FrameChangedEvent` (extended in 3.7 with ball) drives score display + (in 3.10) log sync — one source of truth for "current tick".
- Keep the demo tactic fallback for canvas development, but the workspace's primary object becomes the user's tactic + last match (3.2 already gated demo behind "user has no tactic").
- API 404 (missing frames file) → friendly "Replay unavailable" error state, retry button (AC: matches 3.5 AC#4 philosophy).
- Architecture compliance: English-only code/comments; apiClient everywhere; inline styles; data-testids; Zustand.

### Test Selectors

| Selector | Element |
|----------|---------|
| `[data-testid="replay-loading-overlay"]` | Loading overlay |
| `[data-testid="replay-error-message"]` | Replay load failure |
| `[data-testid="back-to-editor-button"]` | Exit replay to workspace |
| `[data-testid="watch-last-match-button"]` | Mount-time most-recent entry |
| `[data-testid="play-pause-button"]` | Play/pause control (Timeline) |
| `[data-testid="frame-counter"]` | Current frame display (exists in Timeline — verify name) |

### Previous Story Intelligence

- From 3.7: `loadFrames`, Ball sprite, score display, celebration already exist; playback primitives (play/pause/step/seekFrame) exist but were fed by canned frames.
- From 3.5: result banner + `watch-replay-button` exist and currently no-op.
- From deferred-work.md: "Game.destroy()/init failure edges" — loadFrames guards via pendingFrames queue pattern (3.7); same care here on autoplay.
- From 2.x e2e: workspace.spec.ts asserts canvas mount — keep those green.

### Project Structure Notes

- Update: `src/components/canvas/engine/Game.ts` (remove canned sim), `src/components/layout/{AppShell,Timeline}.tsx`, `src/stores/matchStore.ts`, `src/types/canvas-events.ts` if payload changed
- Update: `tests/e2e/practice-match.spec.ts`, `tests/unit/stores/match-store.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.8: Replay Playback System]
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Flux de Replay]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#The Watch Phase (DEFINING EXPERIENCE)]
- [Source: src/components/canvas/engine/Game.ts:202] (canned sim being retired)
- [Source: src/components/layout/Timeline.tsx] (existing controls)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
