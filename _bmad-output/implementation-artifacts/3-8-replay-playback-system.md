---
baseline_commit: e94068f493278fc5cf4102c5ae04851c5e7733e9
---

# Story 3.8: Replay Playback System

Status: done

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

- [x] Task 1: Frame data source swap in `Game.ts`
  - [x] `Game.loadFrames(frames)` (built in 3.7) becomes THE data source; retire the canned sine-wave generator (`runSimulation` at Game.ts:202) — keep the public `runSimulation()` handle API but reimplement it as a no-op/deprecation path so TacticsCanvasHandle stays stable (frontend callers removed in Task 3)
  - [x] Autoplay on load: `play()` from frame 0; loop off (stop at last frame, show final score)
  - [x] 60fps playback via Pixi ticker: advance currentFrame by delta-time × 60 (time-based, not per-tick, so playback speed is correct regardless of render rate)

### Frontend Tasks (React)

- [x] Task 2: Replay loading in `matchStore`
  - [x] `loadReplay(matchId)`: GET `/api/matches/{id}/frames` via apiClient → parse JSON (~5-8MB, parse once, keep in store) → set `replayFrames`, `replayMatch`; states: `isReplayLoading`, `replayError`
  - [x] `fetchLatestMatch()` → GET /api/matches (first completed match) for AC #4
  - [x] Memory guard: releasing previous replay when loading a new one; do NOT retain frames in more than one store slice
- [x] Task 3: AppShell wiring (AC: #1, #4)
  - [x] "Watch Replay" button (from 3.5 result banner) → `loadReplay(lastMatch.id)` → on success `canvasRef.current.loadFrames(frames)` + autoplay; show `data-testid="replay-loading-overlay"` with "Loading replay..." while fetching
  - [x] On workspace mount: if a completed match exists, show a subtle "Watch last match" entry (AC #4 — most recent match reachable in 1 click); do NOT auto-open the viewer
  - [x] Replace the 3.2-era demo tactic flow: once frames load, canvas shows the match; returning to edit mode re-loads the user tactic (`loadTactic`) — add explicit "Back to editor" control `data-testid="back-to-editor-button"`
- [x] Task 4: Playback controls (AC: #2, #3)
  - [x] Extend existing `Timeline.tsx` play/pause wiring to canvasStore-backed state (isPlaying already exists); Space keydown toggles play/pause — MUST ignore keystrokes originating from Monaco textarea (check `document.activeElement` tag/isContentEditable) so editing stays unaffected
  - [x] Pause/resume keeps exact current frame; play state survives seek (paused stays paused)
- [x] Task 5: Unit tests
  - [x] matchStore: loadReplay success/error/loading, latest-match selection, frames released on reload
  - [x] Space-toggle helper (extracted pure function `shouldTogglePlayback(event)` — testable without Monaco)

### Testing Tasks (E2E)

- [x] Task 6: Revive replay section of `tests/e2e/practice-match.spec.ts` (AC: #1-#4)
  - [x] Full loop: register → 5-slot lineup → Test vs Bot → Watch Replay → canvas visible with players/ball → autoplay advances frames (assert frame counter increases) → pause freezes counter → Space resumes → reload page → "Watch last match" opens most recent replay

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

euria-code (infomaniak/euria-code), opencode CLI — 2026-09-15

### Debug Log References

- Monaco space-swallowing investigation (E2E Story 2.5 failures introduced by the Space handler): a temporary Playwright probe (`tests/e2e/zz-probe.spec.ts`, removed after diagnosis) logged keydown targets inside the editor. Finding: Monaco 0.55 edits through a `div.native-edit-context` (EditContext API) — not a textarea, `isContentEditable === false` — so the story's "check activeElement tag/isContentEditable" recipe misses it and Space was preventDefault'ed (editor content `let x = 1;` became `letx=1;`). Fix: `isEditableTarget` returns true for any target with a `.monaco-editor` ancestor (robust across Monaco input backends), plus the tag/contentEditable checks. Probe removed; previously failing E2E verified green in isolation (4/4) and the practice-match replay loop still passes (5/5).

### Completion Notes List

- **Task 1 (engine):** `loadFrames()` is now the sole data source. `runSimulation()` kept as a no-op deprecation path (warns, returns empty `SimulationResult`, never fires `onSimulationComplete`) so `TacticsCanvasHandle` stays stable; AppShell's `onSimulationComplete` wiring and `setSimulationReady` call removed (frontend canned-sim callers). Autoplay: `loadFramesInternal` sets `isPlaying = true` before `applyFrame(0)`; loop-off (gameLoop clamps at last frame and pauses, final score stays). Playback advanced time-based via `ticker.deltaMS/1000*60` (render-rate independent — the NFR3 smoothness guarantee is architectural; E2E asserts the frame counter advances).
- **onFrameChanged contract extended:** engine emits a 5th `playing` arg mirroring `isPlaying` (applyFrame covers play, pause-seek and end-of-playback). Fixes a stale-⏸ UI bug: after autoplay reached the last frame, the store previously never learned the engine had stopped. `FrameChangedEvent` in canvas-events.ts untouched (that type is not the transport for these callbacks; no payload change needed).
- **Task 2 (store):** `replayFrames/replayMatch/isReplayLoading/replayError/latestMatch` + `loadReplay/fetchLatestMatch/clearReplay`. The endpoint serves the engine's raw `SimulationFrameFile` JSON (`{ match_id, seed, total_frames, result, frames }`) — the store extracts `.frames` (typed as `MatchFramesFile`) and validates it, surfacing "Replay unavailable. This match cannot be watched." on 404/malformed and "Replay unavailable. Please try again." otherwise. `fetchLatestMatch` picks the first `completed` entry from the newest-first paginated list; failures keep `latestMatch` null (subtle entry, no error surface).
- **Memory guard:** previous frames released at load START (not after the new fetch resolves); double-load ignored while in flight. Frames are parsed once and stored only in `matchStore.replayFrames`; `canvasStore.matchFrames` (score slice) receives the same array reference — one parse, one array, no deep copies. `clearReplay()` (back-to-editor, tactic-tab switch) drops the reference so the ~8MB is collectable. Note: `canvasStore.matchFrames` intentionally stays (structure notes don't list canvasStore for changes; the 3.7 test-hook E2E relies on it).
- **Task 3 (shell):** Watch Replay loads + autoplays with a fixed `replay-loading-overlay`; mount-time `watch-last-match-button` (subtle corner chip, hidden while loading/in replay/on error, never auto-opens); `back-to-editor-button` restores the active tactic + resets playback/player states. Tab-switching during a replay also exits replay mode (tactic-load effect calls `clearReplay()`).
- **Task 4 (controls):** Timeline play button got `data-testid="play-pause-button"`, frame counter `data-testid="frame-counter"` (selector table said "verify name" — it did not exist yet). Space toggle via pure `shouldTogglePlayback(event)`; handler preventDefaults Space (page scroll / focused-button re-activation) only when toggling. Pause keeps the exact frame; seek preserves playing/paused (engine untouched semantics, now store-synced via the `playing` flag).
- **Task 5:** 9 new matchStore tests (success/loading/404/network/malformed/release-on-reload/match-resolution/latest-match ×3/clear/reset extended) + 6 `shouldTogglePlayback` tests. Suite: 408/408 green.
- **Task 6:** new E2E drives the real full loop (register → StarterAI×5 → Test vs Bot → Watch Replay → autoplay advance → pause freeze → resume → Space pause/resume → reload → Watch last match → back to editor). 5/5 chromium, 10/10 firefox+webkit. tactic-tabs/panel-layout/auth E2E identical to baseline (one pre-existing failure, untouched by this story); workspace.spec.ts has a pre-existing flaky/failing set (script-factory 422s + Monaco worker timing — verified identical failure modes on the stashed baseline).
- **ESLint/TS:** 0 errors, 5 warnings all pre-existing (TacticsCanvas exhaustive-deps, Game `finalConfig`, AppShell `teamId`, canvasStore `Position`, debuggerStore `get` — verified on baseline).

### File List

- src/components/canvas/engine/Game.ts (modified)
- src/components/canvas/TacticsCanvas.tsx (modified)
- src/components/layout/AppShell.tsx (modified)
- src/components/layout/MatchStatusOverlay.tsx (modified)
- src/components/layout/Timeline.tsx (modified)
- src/stores/matchStore.ts (modified)
- src/types/shared.ts (modified)
- src/lib/playbackShortcuts.ts (new)
- tests/unit/stores/match-store.test.ts (modified)
- tests/unit/lib/playback-shortcuts.test.ts (new)
- tests/e2e/practice-match.spec.ts (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — status tracking)

### Change Log

- 2026-09-15: Story 3.8 implemented — replay playback over real match frames: engine data-source swap (canned sim retired to a no-op), matchStore replay loading with memory guard, AppShell Watch Replay / Watch last match / Back to editor wiring, Space play-pause shortcut with Monaco-safe guard, unit tests (15 new) and the revived E2E replay loop. Status → review.

### Review Findings

#### Decision needed

- [x] [Review][Decision] Space hijacks focused-button activation — RESOLVED: option (a), exclude BUTTON/A/[role=button] targets so native Space activation works (see patch below).
- [x] [Review][Decision] Replay reload memory-guard design has two broken edges — RESOLVED: option (a), release-on-success — drop the old frames only when the new payload is ready; UI stays coherent during reload (see patch below).
- [x] [Review][Decision] No abort/cancel for the ~5-8MB frames fetch — RESOLVED: option (c), add a cancel affordance on the loading overlay (see patch below).

#### Patches

- [x] [Review][Patch] Space should not hijack focused-button activation (decision 1a) [src/lib/playbackShortcuts.ts:31-35] — return false for BUTTON/A/[role=button] targets; update the unit test that asserts the current behavior.
- [x] [Review][Patch] Memory guard: release-on-success instead of release-at-start (decision 2a) [src/stores/matchStore.ts:135-155] — keep the old frames until the new payload validates, then swap in one `set`; never blank `replayFrames` during the fetch so `isReplayMode` and the back-to-editor control stay stable.
- [x] [Review][Patch] Add a cancel affordance to the replay loading overlay (decision 3c) [src/components/layout/AppShell.tsx:522] — cancel button aborts the in-flight fetch (AbortController) and clears the loading state.

- [x] [Review][Patch] Stale-response race: loadReplay writes store after clearReplay [src/stores/matchStore.ts:144-165] — no generation token; success `set` after `await` resurrects replay state if the user exited replay mode (tab switch) mid-flight; line 155 also never restores `replayMatch` (left null → Retry dead).
- [x] [Review][Patch] Weak payload validation: empty or malformed frames accepted [src/stores/matchStore.ts:148-155] — `frames: []` passes → silent dead click; malformed frames pass → `computeScore` (src/lib/score.ts:28, AppShell.tsx:246) crashes React render and the engine silently ignores the payload (Game.ts:369,381) → replay UI with no playback.
- [x] [Review][Patch] Space toggle has no frame gate [src/components/layout/AppShell.tsx:373-384] — pressing Space with `totalFrames === 0` (edit mode) sets phantom `isPlaying: true` in the store.
- [x] [Review][Patch] Held Space auto-repeats the toggle [src/components/layout/AppShell.tsx:386-396] — no `event.repeat` check; one held keystroke machine-guns play/pause.
- [x] [Review][Patch] Modifier+Space toggles playback [src/lib/playbackShortcuts.ts:31-35] — Ctrl/Alt/Meta+Space not excluded; hijacks OS/AT chords and future editor shortcuts.
- [x] [Review][Patch] "Watch last match" chip stale/absent within a session [src/stores/matchStore.ts:110] — `latestMatch` fetched once on auth (AppShell.tsx:163-167); `startPracticeMatch` never refreshes it → violates AC #4 mid-session (first-ever match shows no chip; later matches replay a stale one).
- [x] [Review][Patch] fetchLatestMatch error wipes known value [src/stores/matchStore.ts:180-181] — catch nulls `latestMatch` even when a previous success existed; transient failure hides a working chip.
- [x] [Review][Patch] Tab switch mid-replay: store playback state goes stale [src/components/layout/AppShell.tsx:144-159] — tactic-load effect resets frames + clearReplay but not `updatePlaybackState`/`updatePlayerStates`; engine resets silently (Game.ts:513-515); Timeline (always rendered, AppShell.tsx:568) shows stale playing/frame N.
- [x] [Review][Patch] play() at last frame cannot restart the replay [src/components/canvas/engine/Game.ts:664-666] — sets `isPlaying` only; gameLoop clamps+pauses instantly → rewatch requires reload.
- [x] [Review][Patch] Back-to-editor with no tactic: ghost replay keeps rendering [src/components/layout/AppShell.tsx:289-294] — when `target` is null the engine is never told; frozen/playing replay persists behind edit-mode UI.
- [x] [Review][Patch] 401 on frames fetch loops retry forever on dead session [src/stores/matchStore.ts:159-162] — treated as retryable; authStore.ts:149-151 precedent is to clear the token on 401.
- [x] [Review][Patch] E2E: unresolved `Locator` type import + flaky patterns [tests/e2e/practice-match.spec.ts:20] — `Locator` imported from support/fixtures which exports only test/expect (TS2305 if tests ever typechecked); overlay `toBeVisible` races instant local loads; freeze assertions rely on `waitForTimeout(500)`.
- [x] [Review][Patch] Dead canvasStore.simulationReady slice [src/stores/canvasStore.ts:21,42,55,83] — writer and reader removed in this diff; flag permanently false. Remove slice + action (and add `@deprecated` JSDoc to `Game.runSimulation`).
- [x] [Review][Patch] Replay overlay/banner/buttons lack ARIA semantics [src/components/layout/AppShell.tsx:493-522] — overlay needs role="status"/aria-live, error banner role="alert", corner chips need distinguishing aria-labels.

#### Deferred

- [x] [Review][Defer] Generated `tsconfig.tsbuildinfo` tracked in git [tsconfig.tsbuildinfo] — deferred, pre-existing
