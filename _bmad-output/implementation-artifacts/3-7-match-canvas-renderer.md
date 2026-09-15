---
baseline_commit: 0741f7f991b29172a50afdfd7e45e1fb331bf86e
---

# Story 3.7: Match Canvas Renderer

Status: done

## Story

As a user,
I want to see the match visually,
So that I can watch my AI play.

## Acceptance Criteria

1. **Given** a match has frames data, **When** the renderer initializes, **Then** I see a 2D pitch with correct 2:1 proportions, **And** field markings are visible (center line, center circle, penalty boxes, goals).

2. **Given** frames are being rendered, **When** a frame displays, **Then** I see 10 players as colored circles (5 orange, 5 blue), **And** player numbers are visible, **And** the ball is clearly distinguishable.

3. **Given** a goal is scored, **When** the event occurs, **Then** I see visual celebration feedback (white flash + team-colored confetti), **And** the score updates on screen.

## Tasks / Subtasks

### Engine-Renderer Tasks (src/components/canvas/engine/)

- [x] Task 1: Ball sprite `src/components/canvas/engine/Ball.ts` (ABSENT today — ball exists in data only)
  - [x] White circle with dark outline, radius ~0.8% of field width (min readable size), position updates via `updateFromFrame({x, y})`
  - [x] Trail effect (last ~8 positions, fading alpha) — cheap: re-drawn Graphics per frame, respect prefers-reduced-motion
- [x] Task 2: Team colors to UX spec (AC: #2)
  - [x] `Player.ts`: home = ORANGE `#ff6b1a`, away = BLUE `#1a8cff` (today home=blue/away=red — WRONG vs ux-design-specification.md Team Colors; fix + fix any unit test asserting colors)
  - [x] Selected player highlight stays yellow ring; scripted-player green dot (existing) untouched
- [x] Task 3: Pitch palette to UX spec (AC: #1)
  - [x] `Field.ts`: pitch background `#1a2634`, lines `#3a4a5a`, center/goal areas `#2a3a4a` (replaces green grass look); keep percentToScreen helpers
- [x] Task 4: Frame-driven rendering pipeline (AC: #2)
  - [x] `Game.loadFrames(frames: MatchFrame[])`: store parsed frames, reset playback state, destroy/ensure 10 PlayerSprites + Ball sprite exist
  - [x] `Game.applyFrame(index)`: update all sprites from `frames[index]` (players via existing `updateFromState`, ball via new sprite); emit `onFrameChanged` (existing callback contract) with frame data
  - [x] Replace internal canned simulation playback state to be driven by loaded frames (the `runSimulation()` canned generator from Game.ts:202 stays UNTIL 3.8 swaps its data source — this story only adds the rendering pipeline; do not delete `runSimulation` yet)
- [x] Task 5: Goal celebration (AC: #3)
  - [x] On entering a frame whose `events` contains `type:'goal'`: white screen flash (overlay alpha pulse ~300ms) + confetti burst (30-50 particles, team color of scorer + gold `#ffd700`, gravity + fade, ~1.5s lifetime) implemented as Pixi containers in Game
  - [x] Score UI: `AppShell` renders `data-testid="score-display"` ("3 — 2") above/overlaid on canvas; score derived by replaying goal events up to current frame (pure function `computeScore(frames, currentTick)` in `src/lib/score.ts` + unit tests); uses `--text-2xl` 24px per UX spec
  - [x] Respect `prefers-reduced-motion`: flash/confetti skipped, score still updates

### Testing Tasks

- [x] Task 6: Unit tests
  - [x] `src/lib/score.ts` pure function tests (goals before/after tick, both teams, draw)
  - [x] Field palette + percentToScreen regression (existing field.test.ts mirrors logic — update to new palette values)
  - [x] Player color constants export + assertions (orange/blue)
- [x] Task 7: E2E (in `tests/e2e/practice-match.spec.ts`, following 3.5's revival)
  - [x] After a simulated match + replay load (3.8 wires loadFrames; until then test with injected demo frames via a test-only hook OR defer this spec's assertion to 3.8 — mark with a skip note if blocked): canvas shows 10 player circles + 1 ball; score display renders

### Review Findings

- [x] [Review][Patch] Emitted frame-state objects are mutated in place after being handed to React state — resolved (user decision): snapshot-alloc per frame — `applyFrame` emits fresh `{...state, position: {...}}` copies instead of the shared pre-allocated objects (~11 tiny objects/frame, negligible vs the 16ms seek budget) [src/components/canvas/engine/Game.ts:187-209, src/components/layout/AppShell.tsx:163-169]
- [x] [Review][Patch] White flash overlay is never visible (fill alpha 0 defeats the alpha pulse) [src/components/canvas/engine/Game.ts:247,282]
- [x] [Review][Patch] Sprite-census attributes (data-match-players/data-match-ball) race the deferred init path and are never refreshed after pendingFrames flush [src/components/canvas/TacticsCanvas.tsx:201-209, src/components/canvas/engine/Game.ts:158-161]
- [x] [Review][Patch] Multi-goal frames fire only one onGoalScored/celebration while computeScore counts every goal event [src/components/canvas/engine/Game.ts:213-222]
- [x] [Review][Patch] Score keys on frame.index while playback/celebration key on array position — silent desync if index ≠ position [src/lib/score.ts:20-38]
- [x] [Review][Patch] Tactic load does not clear match/score shell state — stale score-display overlays the editing canvas [src/components/layout/AppShell.tsx:125-136]
- [x] [Review][Patch] Script assignment is not blocked during replay — auto-save could persist replay positions onto the active tactic [src/components/canvas/engine/Game.ts:541-547]
- [x] [Review][Patch] pendingTactic + pendingFrames both flush at init — earlier load silently clobbered instead of last-request-wins [src/components/canvas/engine/Game.ts:153-161]
- [x] [Review][Patch] No shape validation on loadFrames payload — malformed frames crash mid-load (half-torn-down engine) and computeScore in React render [src/components/canvas/engine/Game.ts:336-356]
- [x] [Review][Patch] Window resize during celebration keeps trigger-time flash geometry [src/components/canvas/engine/Game.ts:690-702]
- [x] [Review][Patch] Ball caches prefers-reduced-motion at construction while Game checks it live — inconsistent reduced-motion handling [src/components/canvas/engine/Ball.ts:46-48]
- [x] [Review][Patch] Ball position unclamped — NaN/out-of-range frame coords render the ball off-pitch [src/components/canvas/engine/Ball.ts:85-98]
- [x] [Review][Patch] Celebration colors hardcoded instead of the exported PLAYER_HOME_COLOR/PLAYER_AWAY_COLOR single source of truth [src/components/canvas/engine/Game.ts:250]
- [x] [Review][Defer] runSimulation() no longer feeds playback (exposed wrapper, zero callers) — deferred, pre-existing: transitional by design until 3.8 swaps the data source [src/components/canvas/engine/Game.ts:653-688]

## Dev Notes

- **Reality check:** `Game.ts` currently (a) never renders a ball, (b) generates a canned sine-wave "simulation" (Game.ts:202 TODO), (c) has playback primitives (play/pause/step/seekFrame) already working over generated frames. This story adds the REAL rendering pipeline (Ball sprite, frame application, celebration, score) — 3.8 connects it to actual match data. Keep `runSimulation()` intact so the app still works between stories.
- Colors are a deliberate breaking change from the current Player.ts — grep for red/blue assumptions in tests (`field.test.ts`, component tests) and update them.
- Player radius/number rendering exists in `PlayerSprite` — reuse; only team colors change.
- Frame player shape: `{slot, team, x, y, state}` with team 'challenger'|'opponent' in files — renderer maps challenger→orange/home-side, opponent→blue/away-side ONCE in a helper (e.g. `src/lib/teamMapping.ts`), never scattered inline.
- Performance: seek < 16ms (interface-contract.md) — applyFrame must be O(10) sprite updates, no allocations per frame in hot path; confetti uses its own ticker lifecycle, not per-frame allocation.
- Canvas events contract: `onFrameChanged` already emits `playerStates` — extend payload with ball position (update `src/types/canvas-events.ts` FrameChangedEvent accordingly + TacticsCanvas wiring).
- Architecture compliance: English-only code/comments, TypeScript strict, inline styles, data-testids, PixiJS 8 API (Graphics.circle().fill() style already in use).

### Test Selectors

| Selector | Element |
|----------|---------|
| `[data-testid="match-canvas"]` | Canvas container (exists as TacticsCanvas root — verify name) |
| `[data-testid="score-display"]` | Score text overlay |
| `[data-testid="goal-celebration-layer"]` | Celebration container (presence test) |

### Previous Story Intelligence

- From 3.5/3.8 boundary: `watch-replay-button` appears in 3.5 but replay LOAD lands in 3.8 — keep celebration/score code paths testable with synthetic frames.
- From deferred-work.md: Game.destroy()/init failure edges are known — loadFrames must guard `isInitialized` (reuse the pendingTactic queue pattern for frames: `pendingFrames`).
- From deferred-work.md: demo-tactic canvas wiring unobserved by tests — while touching AppShell, ensure canvas mount is asserted (cheap e2e: canvas element exists on /workspace).
- PixiJS `@pixi/react` is a dead dependency — do NOT use it; plain Pixi Application pattern continues.

### Project Structure Notes

- New: `src/components/canvas/engine/Ball.ts`, `src/lib/score.ts`, optional `src/lib/teamMapping.ts`
- Update: `src/components/canvas/engine/{Game.ts,Field.ts,Player.ts,index.ts}`, `src/components/layout/AppShell.tsx` (score display + celebration state), `src/types/canvas-events.ts`
- Update tests: `tests/unit/field.test.ts`, component/unit tests touching colors

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7: Match Canvas Renderer]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Team Colors + Pitch Colors + Celebration Colors]
- [Source: _bmad-output/planning-artifacts/interface-contract.md#Contraintes de Performance]
- [Source: src/components/canvas/engine/Game.ts] (playback primitives, canned sim)
- [Source: src/components/canvas/engine/Player.ts] (PlayerSprite)

## Dev Agent Record

### Agent Model Used

euria-code (infomaniak/euria-code)

### Debug Log References

- RED phase verified before each implementation batch (ball module missing, constants unexported, score/teamMapping absent).
- TypeScript build clean after fixing 3 strict-mode errors (noUncheckedIndexedAccess on Ball trail + frames[0]).
- Pre-existing local E2E flakiness (NOT this story): full 3-project run of practice-match.spec.ts fails the engine-bound tests with `route.fetch: Timeout 15000ms` — 3 concurrent simulations queue on the single engine event loop. Reproduced identically on the baseline (git stash/pop): 2 failed / 3 passed there too. Passes with `--workers=1` (CI parity): 12/12 across chromium/firefox/webkit.

### Completion Notes List

- **Stale task values superseded by Epic 5.1 (deliberate):** Task 2's "today home=blue/away=red" and Task 3's `#3a4a5a`/`#2a3a4a` palette predate commit 9416450 (Epic 5.1 "Arcade Wild Card"). Current code already carries the UX-spec-locked palette (`--pitch-base #1a2634`, `--pitch-lines #ffffff`, letterbox `#111a24`, hard law: team colors never paint the floor). Followed the current ux-design-specification.md (the tasks' stated goal) instead of regressing 5.1; AC #1 (2:1 pitch + markings: center line, double center circle, futsal-area arcs, netted goals) is met by the existing Field rendering. Residue actioned: exported `PLAYER_HOME_COLOR`/`PLAYER_AWAY_COLOR` (Player.ts) and `FIELD_PALETTE` (Field.ts) as single sources of truth, locked by unit tests.
- **Playback is frame-driven:** `gameLoop`/`step`/`seekFrame` operate on `matchFrames` (loaded via `loadFrames`); the internal `simulationFrames` state was replaced. `runSimulation()` kept intact as the legacy canned generator (no longer feeds playback) until 3.8 swaps its data source. `loadTactic` hides the ball and clears frames; `loadFrames` destroys editing sprites and takes the pitch (pendingFrames queue mirrors the pendingTactic pattern, guarding the init race from deferred-work.md).
- **Team mapping centralized** in `src/lib/teamMapping.ts` (challenger→home/orange left half, opponent→away/blue right half) — never inline. Replay sprites are created non-interactive via a new `PlayerSprite` `interactive: false` option, so replay rendering never fights tactic selection/drag.
- **onFrameChanged contract extended with ball position** through GameCallbacks → FrameChangedEvent (`src/types/canvas-events.ts`) → TacticsCanvas → AppShell, per the canvas-events contract.
- **Celebration:** white flash (alpha pulse ~300ms) + 40 confetti particles (60% scorer-team color / 40% gold `#ffd700`, gravity + fade, ~1.5s) live in a Pixi `celebrationLayer` in Game with its own gameLoop lifecycle (no per-frame allocations); goal firing deduped per frame via `lastCelebratedFrame` so playback/seek re-applies don't retrigger. `prefers-reduced-motion` skips flash/confetti; `onGoalScored` still fires so the score updates.
- **Score:** pure `computeScore(frames, currentTick)` (inclusive tick) in `src/lib/score.ts`; AppShell renders `data-testid="score-display"` ("{challenger} — {opponent}", 24px/600) overlaid top-center, only while frames are loaded.
- **Test-only hook (Task 7, sanctioned option A):** `TEST_LOAD_FRAMES_EVENT` (window CustomEvent, dependency-free module `src/lib/testHooks.ts` so Playwright can import it without dragging Pixi/assets into Node). AppShell injects frames into engine + score state; TacticsCanvas publishes the engine sprite census as `data-match-players`/`data-match-ball` attributes on the canvas root. Verified canvas root testid is `field-canvas` (story table's "match-canvas" guess was wrong). 3.8 will replace the hook with real replay loading.
- **Tests added:** 24 new unit tests (score ×10, team-mapping ×4, ball radius/trail ×5, player colors ×3, field palette ×2) + 1 E2E validated on all 3 browser projects. Full suites green: unit 387/387 (21 files), E2E 125/125 (workers=1). TypeScript strict clean; ESLint 0 errors (5 pre-existing warnings untouched).
- **Performance:** applyFrame is O(10) sprite updates + ball; frame states are emitted as fresh snapshots per frame (user decision from code review — consumers/React stores may retain them safely; ~11 tiny objects/frame, negligible vs the < 16ms seek budget); trail capped at 8 points redrawn per frame. Well inside the < 16ms seek budget (interface-contract.md).

### File List

- src/components/canvas/engine/Ball.ts (new)
- src/lib/score.ts (new)
- src/lib/teamMapping.ts (new)
- src/lib/testHooks.ts (new)
- src/components/canvas/engine/Game.ts (modified)
- src/components/canvas/engine/Player.ts (modified)
- src/components/canvas/engine/Field.ts (modified)
- src/components/canvas/engine/index.ts (modified)
- src/components/canvas/TacticsCanvas.tsx (modified)
- src/components/layout/AppShell.tsx (modified)
- src/types/shared.ts (modified)
- src/types/canvas-events.ts (modified)
- tests/unit/components/ball.test.ts (new)
- tests/unit/components/player-colors.test.ts (new)
- tests/unit/lib/score.test.ts (new)
- tests/unit/lib/team-mapping.test.ts (new)
- tests/unit/field.test.ts (modified)
- tests/e2e/practice-match.spec.ts (modified)

## Change Log

- 2026-09-15: Story 3.7 implemented — ball sprite, UX-spec team/pitch palette exports, frame-driven rendering pipeline (loadFrames/applyFrame with ball + player sprite census), goal celebration (flash + confetti + reduced-motion), pure score derivation + score-display overlay, 24 unit tests + 1 E2E (3 browsers). Stale color values from Tasks 2/3 superseded by the Epic 5.1-locked palette (see Completion Notes). Status → review.
- 2026-09-15: Code review (edge-case + acceptance layers) — 13 fixes applied: visible white flash (fill alpha 1 + container-alpha pulse), census republished on init flush and loadTactic (fixes E2E race), onGoalScored per goal event (multi-goal frames), score keyed on array position (not frame.index), match state cleared on tactic load (moved to canvasStore, avoids setState-in-effect), assignScript blocked during replay, last-request-wins pending queues, loadFrames payload validation, resize-safe celebration flash, live prefers-reduced-motion in Ball, ball position clamped, celebration colors from exported constants, frame-state snapshots per frame (user decision). 1 item deferred (runSimulation rewiring → 3.8), 1 dismissed (penalty-box arcs = deliberate Epic 5.1 supersession). Verified: tsc clean, ESLint 0 errors, unit 388/388, E2E practice-match 12/12 (workers=1). Status → done.
