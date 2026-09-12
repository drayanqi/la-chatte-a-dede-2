# Story 3.4: Script Sandboxing & Execution

Status: ready-for-dev

## Story

As a system,
I want to execute user AI code safely,
So that malicious code cannot harm the server.

## Acceptance Criteria

1. **Given** user AI code, **When** it executes in the sandbox, **Then** it has access to: `me`, `ball`, `teammates`, `opponents`, `field` (script-ia-api.md v2.0 contract), **And** it cannot access: filesystem, network, process, **And** `console.log` calls are captured per player per tick.

2. **Given** AI code exceeds the time limit (10ms per tick), **When** the tick executes, **Then** execution is terminated for that tick, **And** the player takes no action.

3. **Given** AI code exceeds the memory limit (8MB), **When** memory is exceeded, **Then** execution is terminated, **And** the player is disabled for the remaining match.

4. **Given** a 3-minute match, **When** the simulation runs, **Then** total simulation completes within 30 seconds (hard cap) — target < 2s for reasonable scripts (NFR2).

5. **Given** a script with multiple actions in one tick, **When** executed, **Then** only the FIRST action applies and a `MULTIPLE_ACTIONS` warning is recorded (same for `DRIBBLE_NO_BALL`, `SHOOT_NO_BALL`).

## Tasks / Subtasks

### Engine Tasks (lachatadede-engine/)

- [ ] Task 1: isolated-vm `IsolatedScriptRunner` implementing the ScriptRunner interface (AC: #1)
  - [ ] One isolate per player per match (10 total), memoryLimit 8MB, script compiled once per match
  - [ ] Per tick: `runSync`/`apply` against a frozen game context snapshot with 10ms deadline; timeout → skip player action that tick (AC: #2)
  - [ ] Total-match watchdog: 30s wall-clock budget; exceeding → all remaining players disabled, simulation continues to 10800 frames with remaining players idle, response marks errors (AC: #4)
  - [ ] Memory exceed → isolate disposed, player disabled for remaining match (AC: #3)
  - [ ] `SCRIPT_ERROR` (runtime/compile error) → player takes no action for the rest of the match, error recorded once with tick + slot
- [ ] Task 2: Build the per-tick `game` context exactly per script-ia-api.md (AC: #1, #5)
  - [ ] `me`: position, hasBall, slot, team ('home'|'away' — 'challenger' maps to 'home', 'opponent' to 'away'), action methods moveToward(x,y), dribble(x,y), stop(), shoot(x,y,power 0.1-1.0)
  - [ ] `ball`: position, velocity, owner; `teammates` (excluding self), `opponents`: position, hasBall, slot, team (READ-ONLY — action methods absent)
  - [ ] `field`: width 100, height 50, goals (home x:0 / away x:100, y:25, width 20), zones (homeBox, awayBox, center)
  - [ ] Compatibility aliases decided in Dev Notes: `moveTo` → moveToward, `isClosestToBall()` engine-computed helper on every Player; `kick`/`kickBall` NOT provided (see alignment Task 5)
  - [ ] Entry point: engine calls `update(game)` — if the script defines no `update` function, record `SCRIPT_ERROR` once ("missing update function")
- [ ] Task 3: Action application + warnings (AC: #5)
  - [ ] First action wins per tick; extra action calls → `MULTIPLE_ACTIONS` warning in that frame's `logs`
  - [ ] `dribble` without ball / `shoot` without ball → respective warning, action ignored
  - [ ] `moveToward` while holding ball → ball released at current position (script-ia-api.md possession rules)
  - [ ] `shoot(x,y,power)`: ball velocity = power × MAX_BALL_SPEED toward (x,y); possession lost
  - [ ] Possession pickup: first player within COLLISION_RADIUS of free ball wins; tie → seeded RNG (seeded shuffle order from 3.3 decides deterministically)
  - [ ] All warnings/errors/logs appended to the frame's `logs: [{team, slot, level: 'log'|'warn'|'error', type, message}]` — this extends backend-architecture.md's frame format (documented variance; 3.10 consumes it)
- [ ] Task 4: `POST /validate-script` endpoint (AC: #1)
  - [ ] Body `{code, language}`; compile in a throwaway isolate; response `{valid: true}` or `{valid: false, errors: [{message, line?}]}`
  - [ ] Laravel: `ScriptController@store/update` call it (Http::timeout(10) to GAME_ENGINE_URL) and persist `is_valid` on scripts (migration to add boolean column, default false); invalid script → 422 with errors; ScriptController must DEGRADE GRACEFULLY if engine is unreachable: save with `is_valid=false` and include warning in response (never block editing offline)
- [ ] Task 5: Frontend AI-API alignment (AC: #1 — the editor currently teaches a DIFFERENT API)
  - [ ] Rewrite `src/lib/gameApiTypes.ts` to the canonical contract: `update(game)` signature, moveToward/dribble/stop/shoot, ball.owner, field.zones; keep JSDoc (drives Monaco tooltips)
  - [ ] Update `src/lib/monacoGameApiProvider.ts` suggestions: `me.` → moveToward, dribble, stop, shoot, hasBall, position, slot, team, isClosestToBall; `ball.` → position, velocity, owner; add `field.` and `game.` context
  - [ ] Replace `STARTER_AI_CODE` in `lachatadede-api/app/Http/Controllers/AuthController.php` with a working starter using the canonical API (adapt script-ia-api.md's "Attaquant Simple" so the starter scores vs Easy bot in 3.6); update `tests/Feature/Auth/RegisterTest.php` assertions and `tests/e2e/auth.spec.ts`/`workspace.spec.ts` references to the old code strings
  - [ ] Update unit tests `tests/unit/lib/monacoGameApiProvider.test.ts` for new suggestions

### Testing Tasks

- [ ] Task 6: Engine tests (AC: #1-#5)
  - [ ] Sandbox escape attempts (require, process, fetch, infinite loop) → no crash, error/timeout handled; infinite loop burns only its tick
  - [ ] Determinism WITH scripts: same seed + same scripts → byte-equal output (extends 3.3 test)
  - [ ] console.log capture per player per tick appears in frame logs with correct slot/team
  - [ ] Limits: tick timeout, memory disable, 30s watchdog (simulate with scripts that intentionally spin)
  - [ ] Warnings: multiple actions, dribble/shoot without ball; one-action-per-tick winner semantics
- [ ] Task 7: Laravel feature tests for validate flow (mock engine HTTP via Http::fake): store valid script sets is_valid=true; unreachable engine still stores with is_valid=false + warning; 422 on invalid

## Dev Notes

- **isolated-vm build risk:** it is a native module. `node:24-alpine` + `python3 make g++` in Dockerfile.node (added in 3.3) is the path — verify `npm ci` compiles in the container EARLY in this story; if node 24 lacks a prebuilt/compilable isolated-vm release, pin the newest working version and note it in Completion Notes (do NOT swap to vm2 — abandoned and insecure).
- **Canonical AI API = script-ia-api.md v2.0 (validated).** The Monaco autocomplete + starter AI shipped in Epic 2 were built from the PRD journeys (`moveTo/kick/isClosestToBall`, `update(me, ball, ...)`), BEFORE script-ia-api.md existed — epics.md's input list proves it never saw that doc. This story makes script-ia-api.md canonical everywhere and pays the alignment debt (Task 5). The cheap aliases (moveTo, isClosestToBall) preserve existing user scripts/starter behavior; `kick`/`kickBall` are deliberately dropped and migrated (they had no ball-possession semantics).
- Two action model facts that MUST hold (script-ia-api.md): only ONE action per tick executes (first wins); no action → player keeps previous movement (inertie) or stays.
- Warnings/errors are DATA in frames (level: warn/error), so the debug panel (3.10) can render them — do not just console.error them away.
- Timestamps/performance measurement allowed OUTSIDE the simulation (route layer) but never inside the loop.
- Laravel→Node payload for /simulate stays as defined in 3.3, now with real `script` code strings per slot.
- Architecture compliance: English-only code/comments, TypeScript strict in both services.

### Test Selectors

No new UI. Monaco suggestion tests assert new suggestion labels (`moveToward`, `dribble`, `shoot`, `stop`, `isClosestToBall` absent from `ball.` context, etc.).

### Previous Story Intelligence

- From 3.3: ScriptRunner interface + NoopScriptRunner exist; Simulation collects `{actions, logs}` per tick — this story replaces Noop with IsolatedScriptRunner via same interface; determinism test must keep passing.
- From 2.4/2.5: monacoGameApiProvider tests live at `tests/unit/lib/monacoGameApiProvider.test.ts`; Monaco uses local bundle (monacoSetup.ts) — don't touch loader.
- From 1.4/2.x: registration e2e/unit tests assert starter file name "StarterAI.js" — keep the name, only code content changes.
- Starter AI current content (AuthController.php:18-47) uses `update(me, ball, teammates, opponents)` + `me.kickBall` — internally inconsistent with even the Epic-2 autocomplete; replacing it fixes both.

### Project Structure Notes

- Update: `lachatadede-engine/src/engine/{ScriptRunner.ts,Simulation.ts,types.ts}`, `src/routes/` (+validate.ts), package.json (isolated-vm dep)
- Update: `lachatadede-api/app/Http/Controllers/ScriptController.php`, new migration `add_is_valid_to_scripts_table`, `app/Http/Controllers/AuthController.php` (STARTER_AI_CODE)
- Update: `src/lib/gameApiTypes.ts`, `src/lib/monacoGameApiProvider.ts` + their tests
- New: `lachatadede-engine/src/engine/IsolatedScriptRunner.ts`, context-builder module

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4: Script Sandboxing & Execution]
- [Source: _bmad-output/planning-artifacts/script-ia-api.md] (authoritative AI API, warnings, errors, possession, constants)
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Limites Sandboxing + endpoints]
- [Source: src/lib/gameApiTypes.ts] (superseded Epic-2 API to migrate)
- [Source: lachatadede-api/app/Http/Controllers/AuthController.php:18-47] (STARTER_AI_CODE to replace)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
