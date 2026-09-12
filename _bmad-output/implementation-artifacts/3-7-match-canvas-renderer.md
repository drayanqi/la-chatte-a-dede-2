# Story 3.7: Match Canvas Renderer

Status: ready-for-dev

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

- [ ] Task 1: Ball sprite `src/components/canvas/engine/Ball.ts` (ABSENT today — ball exists in data only)
  - [ ] White circle with dark outline, radius ~0.8% of field width (min readable size), position updates via `updateFromFrame({x, y})`
  - [ ] Trail effect (last ~8 positions, fading alpha) — cheap: re-drawn Graphics per frame, respect prefers-reduced-motion
- [ ] Task 2: Team colors to UX spec (AC: #2)
  - [ ] `Player.ts`: home = ORANGE `#ff6b1a`, away = BLUE `#1a8cff` (today home=blue/away=red — WRONG vs ux-design-specification.md Team Colors; fix + fix any unit test asserting colors)
  - [ ] Selected player highlight stays yellow ring; scripted-player green dot (existing) untouched
- [ ] Task 3: Pitch palette to UX spec (AC: #1)
  - [ ] `Field.ts`: pitch background `#1a2634`, lines `#3a4a5a`, center/goal areas `#2a3a4a` (replaces green grass look); keep percentToScreen helpers
- [ ] Task 4: Frame-driven rendering pipeline (AC: #2)
  - [ ] `Game.loadFrames(frames: MatchFrame[])`: store parsed frames, reset playback state, destroy/ensure 10 PlayerSprites + Ball sprite exist
  - [ ] `Game.applyFrame(index)`: update all sprites from `frames[index]` (players via existing `updateFromState`, ball via new sprite); emit `onFrameChanged` (existing callback contract) with frame data
  - [ ] Replace internal canned simulation playback state to be driven by loaded frames (the `runSimulation()` canned generator from Game.ts:202 stays UNTIL 3.8 swaps its data source — this story only adds the rendering pipeline; do not delete `runSimulation` yet)
- [ ] Task 5: Goal celebration (AC: #3)
  - [ ] On entering a frame whose `events` contains `type:'goal'`: white screen flash (overlay alpha pulse ~300ms) + confetti burst (30-50 particles, team color of scorer + gold `#ffd700`, gravity + fade, ~1.5s lifetime) implemented as Pixi containers in Game
  - [ ] Score UI: `AppShell` renders `data-testid="score-display"` ("3 — 2") above/overlaid on canvas; score derived by replaying goal events up to current frame (pure function `computeScore(frames, currentTick)` in `src/lib/score.ts` + unit tests); uses `--text-2xl` 24px per UX spec
  - [ ] Respect `prefers-reduced-motion`: flash/confetti skipped, score still updates

### Testing Tasks

- [ ] Task 6: Unit tests
  - [ ] `src/lib/score.ts` pure function tests (goals before/after tick, both teams, draw)
  - [ ] Field palette + percentToScreen regression (existing field.test.ts mirrors logic — update to new palette values)
  - [ ] Player color constants export + assertions (orange/blue)
- [ ] Task 7: E2E (in `tests/e2e/practice-match.spec.ts`, following 3.5's revival)
  - [ ] After a simulated match + replay load (3.8 wires loadFrames; until then test with injected demo frames via a test-only hook OR defer this spec's assertion to 3.8 — mark with a skip note if blocked): canvas shows 10 player circles + 1 ball; score display renders

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

### Debug Log References

### Completion Notes List

### File List
