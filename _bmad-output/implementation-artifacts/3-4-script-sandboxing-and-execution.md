---
baseline_commit: e9be19c31c28ca9b3779cec4e0b6557a8b8f34ba
---

# Story 3.4: Script Sandboxing & Execution

Status: done

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

- [x] Task 1: isolated-vm `IsolatedScriptRunner` implementing the ScriptRunner interface (AC: #1)
  - [x] One isolate per player per match (10 total), memoryLimit 8MB, script compiled once per match
  - [x] Per tick: `runSync`/`apply` against a frozen game context snapshot with 10ms deadline; timeout → skip player action that tick (AC: #2)
  - [x] Total-match watchdog: 30s wall-clock budget; exceeding → all remaining players disabled, simulation continues to 10800 frames with remaining players idle, response marks errors (AC: #4)
  - [x] Memory exceed → isolate disposed, player disabled for remaining match (AC: #3)
  - [x] `SCRIPT_ERROR` (runtime/compile error) → player takes no action for the rest of the match, error recorded once with tick + slot
- [x] Task 2: Build the per-tick `game` context exactly per script-ia-api.md (AC: #1, #5)
  - [x] `me`: position, hasBall, slot, team ('home'|'away' — 'challenger' maps to 'home', 'opponent' to 'away'), action methods moveToward(x,y), dribble(x,y), stop(), shoot(x,y,power 0.1-1.0)
  - [x] `ball`: position, velocity, owner; `teammates` (excluding self), `opponents`: position, hasBall, slot, team (READ-ONLY — action methods absent)
  - [x] `field`: width 100, height 50, goals (home x:0 / away x:100, y:25, width 20), zones (homeBox, awayBox, center)
  - [x] Compatibility aliases decided in Dev Notes: `moveTo` → moveToward, `isClosestToBall()` engine-computed helper on every Player; `kick`/`kickBall` NOT provided (see alignment Task 5)
  - [x] Entry point: engine calls `update(game)` — if the script defines no `update` function, record `SCRIPT_ERROR` once ("missing update function")
- [x] Task 3: Action application + warnings (AC: #5)
  - [x] First action wins per tick; extra action calls → `MULTIPLE_ACTIONS` warning in that frame's `logs`
  - [x] `dribble` without ball / `shoot` without ball → respective warning, action ignored
  - [x] `moveToward` while holding ball → ball released at current position (script-ia-api.md possession rules)
  - [x] `shoot(x,y,power)`: ball velocity = power × MAX_BALL_SPEED toward (x,y); possession lost
  - [x] Possession pickup: first player within COLLISION_RADIUS of free ball wins; tie → seeded RNG (seeded shuffle order from 3.3 decides deterministically)
  - [x] All warnings/errors/logs appended to the frame's `logs: [{team, slot, level: 'log'|'warn'|'error', type, message}]` — this extends backend-architecture.md's frame format (documented variance; 3.10 consumes it)
- [x] Task 4: `POST /validate-script` endpoint (AC: #1)
  - [x] Body `{code, language}`; compile in a throwaway isolate; response `{valid: true}` or `{valid: false, errors: [{message, line?}]}`
  - [x] Laravel: `ScriptController@store/update` call it (Http::timeout(10) to GAME_ENGINE_URL) and persist `is_valid` on scripts (migration to add boolean column, default false); invalid script → 422 with errors; ScriptController must DEGRADE GRACEFULLY if engine is unreachable: save with `is_valid=false` and include warning in response (never block editing offline)
- [x] Task 5: Frontend AI-API alignment (AC: #1 — the editor currently teaches a DIFFERENT API)
  - [x] Rewrite `src/lib/gameApiTypes.ts` to the canonical contract: `update(game)` signature, moveToward/dribble/stop/shoot, ball.owner, field.zones; keep JSDoc (drives Monaco tooltips)
  - [x] Update `src/lib/monacoGameApiProvider.ts` suggestions: `me.` → moveToward, dribble, stop, shoot, hasBall, position, slot, team, isClosestToBall; `ball.` → position, velocity, owner; add `field.` and `game.` context
  - [x] Replace `STARTER_AI_CODE` in `lachatadede-api/app/Http/Controllers/AuthController.php` with a working starter using the canonical API (adapt script-ia-api.md's "Attaquant Simple" so the starter scores vs Easy bot in 3.6); update `tests/Feature/Auth/RegisterTest.php` assertions and `tests/e2e/auth.spec.ts`/`workspace.spec.ts` references to the old code strings
  - [x] Update unit tests `tests/unit/lib/monacoGameApiProvider.test.ts` for new suggestions

### Testing Tasks

- [x] Task 6: Engine tests (AC: #1-#5)
  - [x] Sandbox escape attempts (require, process, fetch, infinite loop) → no crash, error/timeout handled; infinite loop burns only its tick
  - [x] Determinism WITH scripts: same seed + same scripts → byte-equal output (extends 3.3 test)
  - [x] console.log capture per player per tick appears in frame logs with correct slot/team
  - [x] Limits: tick timeout, memory disable, 30s watchdog (simulate with scripts that intentionally spin)
  - [x] Warnings: multiple actions, dribble/shoot without ball; one-action-per-tick winner semantics
- [x] Task 7: Laravel feature tests for validate flow (mock engine HTTP via Http::fake): store valid script sets is_valid=true; unreachable engine still stores with is_valid=false + warning; 422 on invalid

### Review Findings

- [x] [Review][Defer] Engine endpoints unauthenticated/unthrottled; compile has no deadline — deferred per decision (2026-09-14): engine is internal-only (compose, no published ports), throttling/auth not a concern for now; consolidate with the 3.3 /simulate hardening item [lachatadede-engine/src/routes/validate.ts:39-42]
- [x] [Review][Patch] script-ia-api.md documents goal width 10; engine/story/geometry all say 20 — reconcile doc to 20 [_bmad-output/planning-artifacts/script-ia-api.md:96-99]
- [x] [Review][Patch] Isolate leaked on "missing update function" path — early return before `player.isolate = isolate`, so the live 8MB isolate is never disposed [lachatadede-engine/src/engine/IsolatedScriptRunner.ts:211-222]
- [x] [Review][Patch] Frame logs unbounded per match — per-tick cap (100) only; no match-level aggregate cap and no message size cap; 10 players × 100 logs × 10800 ticks ≈ 10.8M entries worst case [lachatadede-engine/src/engine/contextBuilder.ts:187-194]
- [x] [Review][Patch] Language-only update keeps stale is_valid — validation gated on `array_key_exists('code', $changes)`; flipping language to e.g. python skips the engine and preserves is_valid=true [lachatadede-api/app/Http/Controllers/ScriptController.php:120-131]
- [x] [Review][Patch] /validate-script compiles without the console preamble — top-level `console.log` throws ReferenceError at validation (→ 422) but runs fine in a match (runner prepends SCRIPT_PREAMBLE console no-op) [lachatadede-engine/src/routes/validate.ts:30-42 vs lachatadede-engine/src/engine/contextBuilder.ts:160]
- [x] [Review][Patch] Watchdog early-returns skip the deferredError flush — compile/init errors deferred in prepare() are silently dropped if the watchdog trips before the first tick (narrow window) [lachatadede-engine/src/engine/IsolatedScriptRunner.ts:125-135]
- [x] [Review][Patch] validateWithEngine swallows failures and mislabels them "unreachable" — `catch (Throwable)` and any non-2xx both map to engine_reachable=false with zero logging; engine diagnostic errors discarded; user warning misattributes cause [lachatadede-api/app/Http/Controllers/ScriptController.php:186-216]
- [x] [Review][Patch] 2xx with non-JSON body → silent 422 — `$response->json() ?? []` yields empty array, so valid=false with engine_reachable=true: user gets 422, empty errors, and no offline warning [lachatadede-api/app/Http/Controllers/ScriptController.php:213]
- [x] [Review][Patch] index() payload omits is_valid — show/store/update include it but the scripts list does not, so the UI cannot render validity state [lachatadede-api/app/Http/Controllers/ScriptController.php:20-35]
- [x] [Review][Patch] Script deleted concurrently during up-to-10s validation → 500 — `update()` touches 0 rows then `refresh()` throws unhandled ModelNotFoundException [lachatadede-api/app/Http/Controllers/ScriptController.php:131-135]
- [x] [Review][Patch] workspace.spec.ts still tests the removed `goal.` context — 'should show goal properties when typing "goal."' types a context Monaco no longer provides; suggest widget never opens [tests/e2e/workspace.spec.ts:1036-1067]
- [x] [Review][Patch] editorStore.generateDefaultCode emits the dead pre-canonical API — `update(me, ball, teammates, opponents, goal)` + `me.moveTo(...)`; engine calls `update(game)`, so new UI scripts error/no-op [src/stores/editorStore.ts:126-140]
- [x] [Review][Patch] isClosestToBall tie-break: docs promise "lower slot", code uses payload order — candidates iterate in payload order with strict `<`; /simulate validates slot uniqueness but not ordering [lachatadede-engine/src/engine/contextBuilder.ts:91-117]
- [x] [Review][Patch] MAIL_PASSWORD removed from .env.example — config/mail.php:47 still reads `env('MAIL_PASSWORD')`; looks like collateral in the GAME_ENGINE_URL hunk [lachatadede-api/.env.example:55-61]
- [x] [Review][Defer] Synchronous CPU-bound /simulate monopolizes the engine's single event loop — concurrent /validate-script calls then miss Laravel's 10s timeout and degrade saves to "unreachable"; architectural, needs worker/queue strategy [lachatadede-engine/src/routes/simulate.ts:95-133] — deferred, pre-existing
- [x] [Review][Defer] AC#4's "<2s target for reasonable scripts" is unenforced — the only sandboxed full-match perf test asserts a 15s bound; Completion Note 13 documents 1.5–6.5s in practice [lachatadede-engine/src/engine/__tests__/Simulation.test.ts:614-619] — deferred, pre-existing

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

euria-code (Infomaniak)

### Debug Log References

- isolated-vm v7 API verified empirically (see Completion Notes #1); error signatures: timeout `Error("Script execution timed out.")`, memory `Error("Isolate was disposed during execution due to memory limit")`, runtime error message propagates, SyntaxError carries ` [file.js:line:col]`.
- First full-suite run caught a latent 3.3 gap: Simulation never transferred `outcome.logs` into frames (Noop always returned empty so tests could not catch it) — fixed in Simulation.stepTick.

### Completion Notes List

1. **isolated-vm v7.0.1** compiles and runs on Node 24 (verified locally AND inside the node:24-alpine production Docker image, dev + production targets both build). The story's `runSync`/`apply` wording assumed the v4-era API; v7 differs (`context.global.getSync(name, {reference: true})`, `applySync(receiver, args, {timeout, arguments: {copy: true}, result: {copy: true}})`) — handled. NOT swapped to vm2.
2. **Sandbox architecture**: the host builds a plain-data snapshot per tick; an in-isolate shim (`contextBuilder.ts` SCRIPT_SHIM) constructs the script-ia-api.md `game` object and wraps action methods as recorders. Data crosses the boundary only as deep copies → scripts cannot mutate the simulation or other players; `require`/`process`/`fetch`/`console` do not exist in the isolate by construction. Top-level `console` is a no-op shell (top-level runs once; per-tick console capture replaces it inside `__run`).
3. **Action semantics (documented interpretation of AC #5)**: the first VALID action of a tick applies; an invalid action (`dribble`/`shoot` without ball) is ignored with its warning and does NOT consume the one-action budget; any action call after an action was recorded produces `MULTIPLE_ACTIONS` only. `moveToward` with the ball releases it in place (3.3 behavior kept).
4. **`ball.owner`** is a string per script-ia-api.md: `"<team>-<slot>"` (e.g. `home-1`), `null` when free. Team mapping: challenger→`home`, opponent→`away`.
5. **Blank scripts** are treated as idle players (no isolate created, no logs, no actions) — keeps empty code legitimate (Epic 2/3 flows) and avoids error noise for empty slots.
6. **Compile/init** happens once per match in `prepare()` with a 1s deadline; syntax errors are reported with the user-file line number (bundle preamble offset corrected). Runtime errors inside `update()` are caught by the shim and returned as SCRIPT_ERROR data → player disabled for the rest of the match, recorded once with tick (frame index) + slot.
7. **Watchdog (AC #4)**: 30s wall-clock budget since `prepare()`, checked per tick in the runner; trips → all players disabled, simulation continues idle to 10800 frames, and the problem is surfaced via the new additive `errors: string[]` field on the `/simulate` response (documented variance). This is the only wall-clock-dependent behavior; the deterministic core never reads the clock, and determinism tests run far below the budget.
8. **Frame `logs` format variance**: entries are `{team, slot, level: 'log'|'warn'|'error', type, message}` (backend-architecture.md frame format extended as the story directs; 3.10 consumes it). Fixed the 3.3 gap where logs were dropped (see Debug Log).
9. **ScriptController decisions**: empty/blank code skips the engine call and saves `is_valid=false` without 422 (must never block editing); engine unreachable/timeout/5xx → graceful save `is_valid=false` + `warning` in the response; `update` revalidates only when the `code` key is sent (a rename keeps `is_valid`); responses now include `is_valid`. `phpunit.xml` points `GAME_ENGINE_URL` at an unreachable port so the whole API suite exercises the degradation path hermetically; engine-reachable paths use `Http::fake` (Task 7 tests).
10. **Registration** stores the starter with `is_valid=true` (shipped known-good code; registration must not depend on a running engine). `STARTER_AI_CODE` replaced with the canonical "Attaquant Simple" adaptation.
11. **Frontend**: `gameApiTypes.ts` rewritten to the canonical contract (rich JSDoc kept for Monaco); provider contexts are now `me.` / `teammates[i].`+`opponents[i].` (read-only surface) / `ball.` / `field.` / `game.`; legacy `goal.` / `player.` contexts removed. Engine keeps the decided compat aliases (`moveTo`, `isClosestToBall()`) but Monaco teaches only the canonical API (`kick`/`kickBall` nowhere).
12. **e2e fixtures**: `script-factory.ts` starter/goalkeeper scripts rewritten to the canonical API; active `workspace.spec.ts` assertions updated (auth.spec.ts only referenced the unchanged "StarterAI.js" name). The 13 pre-existing unhandled rejections in the frontend unit suite (mocked `loader.init()` resolving `{}`) are unchanged — verified identical count on the pre-story baseline.
13. **Performance (NFR2)**: full 10800-tick match with 10 ACTIVE sandboxed scripts completes in ~1.5-6.5s locally (machine-load dependent) — well under the 30s hard cap; the <2s Noop/blank-script NFR2 test is unchanged and passing.
14. Story assumed `runSync`/`apply` against "frozen" context: implemented as deep-copy transfer (the copy is the frozen snapshot); deep-freezing the copied objects would break user-code patterns without adding safety (mutations are discarded per tick).
15. **Test stability under load**: sandboxed tick deadlines are wall-clock (isolated-vm), so on a loaded machine even trivial scripts can miss a 10ms deadline and full-match byte-equality can flake. Mitigations: engine test files run sequentially (`fileParallelism: false` in vitest.config.ts), full-match/behavior tests use a generous tick deadline (mechanism coverage — the contractual 10ms/8MB/30s VALUES are pinned by constants.test.ts), and the engine /simulate determinism gate keeps its empty-script baseline.

### File List

- lachatadede-engine/package.json
- lachatadede-engine/package-lock.json
- lachatadede-engine/vitest.config.ts
- lachatadede-engine/src/app.ts
- lachatadede-engine/src/engine/BallState.ts
- lachatadede-engine/src/engine/ScriptRunner.ts
- lachatadede-engine/src/engine/Simulation.ts
- lachatadede-engine/src/engine/constants.ts
- lachatadede-engine/src/engine/types.ts
- lachatadede-engine/src/engine/IsolatedScriptRunner.ts
- lachatadede-engine/src/engine/contextBuilder.ts
- lachatadede-engine/src/routes/simulate.ts
- lachatadede-engine/src/routes/validate.ts
- lachatadede-engine/src/engine/__tests__/IsolatedScriptRunner.test.ts
- lachatadede-engine/src/engine/__tests__/Simulation.test.ts
- lachatadede-engine/src/engine/__tests__/constants.test.ts
- lachatadede-engine/src/routes/__tests__/simulate.test.ts
- lachatadede-engine/src/routes/__tests__/validate.test.ts
- lachatadede-api/app/Http/Controllers/AuthController.php
- lachatadede-api/app/Http/Controllers/ScriptController.php
- lachatadede-api/app/Models/Script.php
- lachatadede-api/config/services.php
- lachatadede-api/phpunit.xml
- lachatadede-api/.env.example
- lachatadede-api/database/migrations/2026_09_13_000000_add_is_valid_to_scripts_table.php
- lachatadede-api/tests/Feature/Auth/RegisterTest.php
- lachatadede-api/tests/Feature/Scripts/ScriptValidationTest.php
- src/lib/gameApiTypes.ts
- src/lib/monacoGameApiProvider.ts
- tests/unit/lib/monacoGameApiProvider.test.ts
- tests/e2e/workspace.spec.ts
- tests/support/fixtures/factories/script-factory.ts

## Change Log

- 2026-09-13: Story 3.4 implemented — isolated-vm sandboxing (IsolatedScriptRunner: 8MB/10ms/30s limits, one isolate per player, compile once per match), per-tick `game` context per script-ia-api.md v2.0 (context builder + in-isolate shim), action/warning semantics (first valid action wins; MULTIPLE_ACTIONS / DRIBBLE_NO_BALL / SHOOT_NO_BALL as frame data), shoot power scaling, structured frame `logs` (+fixed 3.3 logs gap), `POST /validate-script` endpoint, Laravel `is_valid` script validation flow with graceful offline degradation, frontend AI-API alignment (types, Monaco suggestions, canonical starter AI), engine/Laravel/frontend test coverage updated (116 engine, 61 Laravel incl. 9 new validation tests, 343 frontend unit).
- 2026-09-14: Code review passed (3 adversarial layers: 26 raw findings → 14 patched, 3 deferred, 5 dismissed, 2 decisions resolved). Fixes: isolate leak on missing-update path, match-level log cap (MAX_LOGS_PER_MATCH=10000) + 500-char log message truncation, language-only revalidation for is_valid, /validate-script compiles the exact runtime bundle (console preamble + shim) so validation matches match semantics, deferredError flush on watchdog paths, validateWithEngine failure logging + accurate degradation warnings (unreachable vs HTTP error vs non-JSON), is_valid in index payload, concurrent-delete guard on update, isClosestToBall tie-break by slot (not payload order), canonical-API default code in editorStore, workspace.spec field. e2e test, MAIL_PASSWORD restored in .env.example, script-ia-api.md goal width reconciled to 20. Deferred: engine endpoint auth/throttling (user decision: internal-only for now), sync CPU-bound simulate event-loop pressure, <2s perf target unenforced. Suites green: 117 engine, 61 Laravel, 351 frontend unit; tsc clean.
