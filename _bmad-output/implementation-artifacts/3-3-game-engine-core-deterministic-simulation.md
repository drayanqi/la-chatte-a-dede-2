---
baseline_commit: c20edc166f06a4b3a408812133713bf2d77b2f5d
---

# Story 3.3: Game Engine Core — Deterministic Simulation

Status: done

## Story

As a developer,
I want matches to be deterministic,
So that same inputs always produce same outputs (fairness — NFR14, NON-NEGOTIABLE).

## Acceptance Criteria

1. **Given** a match configuration with seed, **When** the simulation runs, **Then** the same seed produces identical frame output every time.

2. **Given** the simulation starts, **When** the engine runs, **Then** it executes at a fixed tick rate of 60 fps, **And** match duration is exactly 3 minutes (10,800 ticks), **And** physics calculations use deterministic math (no `Math.random`, no `Date.now`, no floating-point environment dependence beyond IEEE-754 basics).

3. **Given** a simulation completes, **When** results are calculated, **Then** score is determined by goals scored, **And** frames are written to a JSON file at `{output_path}/{match_id}.json` in the contract format below.

4. **Given** the engine service, **When** it receives `POST /simulate`, **Then** it validates the payload, runs the simulation, writes the file, and responds synchronously.

## Tasks / Subtasks

### Engine Tasks (new Node.js service `lachatadede-engine/`)

- [x] Task 1: Scaffold `lachatadede-engine/` (AC: #4)
  - [x] package.json (type: module, TypeScript ~5.6, strict), tsconfig, vitest config (environment: node — NOT jsdom), scripts: `dev` (tsx watch), `build` (tsc → dist/), `test`
  - [x] Fastify server `src/index.ts`: listens `PORT` env (default 3001) on host `0.0.0.0` (Docker requirement), `POST /simulate` route, `GET /health` route
- [x] Task 2: Constants + seeded RNG (AC: #1, #2)
  - [x] `src/engine/constants.ts` — copy EXACT values from game-rules.md: FIELD_WIDTH 100, FIELD_HEIGHT 50, GOAL_Y_MIN 15, GOAL_Y_MAX 35, CENTER_CIRCLE_RADIUS 10, PLAYER_SPEED 1.0, PLAYERS_PER_TEAM 5, MAX_BALL_SPEED 5.0, BALL_FRICTION 0.95, MIN_BALL_SPEED 0.1, COLLISION_RADIUS 2.0, TICKS_PER_SECOND 60, MATCH_DURATION_SECONDS 180, TOTAL_TICKS 10800
  - [x] `src/engine/seededRandom.ts` — integer-based PRNG (mulberry32), seeded from the payload `seed`; expose `next()`, `range(min,max)`, `shuffle(array)`; the ONLY randomness source in the engine
- [x] Task 3: Simulation core (AC: #1, #2)
  - [x] `src/engine/types.ts` — payload/response/frame types per backend-architecture.md contract (below)
  - [x] `src/engine/Simulation.ts` — main loop per game-rules.md "Sequence de Jeu": init positions from payload tactics → per tick: seeded shuffle of execution order → collect actions from ScriptRunner → apply actions → update positions → ball possession check (COLLISION_RADIUS 2.0) → ball physics (friction ×0.95/tick, stop under 0.1) → edge rebounds (y=0/50 reflect vy; x=0/100 reflect vx when outside goal mouth) → goal check (x≤0 or x≥100 with y in [15,35]) → kickoff reset after goal (all players to initial positions, ball to center (50,25), conceding team gets possession, opponents pushed out of center circle) → record frame
  - [x] `src/engine/BallState.ts` — ball physics: velocity, friction, rebounds with position clamped 0.1 inside walls, owner tracking (slot+team), lost on moveToward, released on shoot
  - [x] `src/engine/ScriptRunner.ts` — INTERFACE ONLY in this story: `prepare(scripts)`, `runTick(tick, context) => {actions, logs}`; provide a `NoopScriptRunner` (no actions, no logs) so 3.3 is fully testable; Story 3.4 delivers the isolated-vm implementation
  - [x] Frame recording: `{index, ball: {x,y}, players: [{slot, team, x, y, state}], events: [], logs: []}` — `logs` reserved (filled in 3.4), `events` records `{type:'goal', team, scorerSlot}` entries
  - [x] Player state machine: `idle` | `moving` | `action` — actions set state for that tick
- [x] Task 4: File output + response (AC: #3, #4)
  - [x] Write JSON to `join(payload.output_path, payload.match_id + '.json')` — create directory if missing
  - [x] Response 200: `{success: true, file, result: {score_challenger, score_opponent, duration_frames: 10800}}`; response 422 on invalid payload; response 500 with `{success: false, error}` on internal failure
  - [x] `POST /simulate` payload (accept and validate): `{match_id, seed, output_path, challenger: {players: [{slot, x, y, script}]}, opponent: {players: [...]}}` — `script` may be empty string in this story (Noop runner)
- [x] Task 5: Engine unit tests (AC: #1, #2, #3)
  - [x] Determinism: run 2 simulations same seed → deep-equal JSON files (byte-compare); 2 different seeds → differing trajectories
  - [x] Ball physics: friction sequence 5.0 → 4.75 → 4.51…, stop below 0.1, rebound reflection examples copied from game-rules.md (exact expected positions)
  - [x] Goal detection: x≥100 & y∈[15,35] scores for challenger; y outside range rebounds
  - [x] Kickoff: after goal, positions reset, ball at (50,25), conceding team possession; initial kickoff decided by seed
  - [x] Full match = exactly 10800 frames, duration_frames = 10800

### Deployment Tasks

- [x] Task 6: Wire Docker (AC: #4)
  - [x] Update `deploy/docker/Dockerfile.node`: build context becomes `lachatadede-engine/`, install build deps (python3 make g++) — Story 3.4 adds isolated-vm which needs them — `npm ci && npm run build`, CMD `node dist/index.js`
  - [x] Update `deploy/docker-compose.yml` node service: correct build context, `restart: unless-stopped`, remove the "will fail until Epic 3" placeholder comment; shared `./storage` volume mount stays (engine writes there via output_path)
  - [x] Local dev documented in engine README: `npm run dev` (tsx watch, port 3001)

### Review Findings

- [x] [Review][Decision→Patch] Goal-line discretization — RESOLVED (Pelo): interpolate the y at line-crossing. `BallState.applyRebounds` now computes the crossing point of the tick's movement segment; goals/rebounds decided at the line, endpoint check kept only for owned (dribbled) balls. 2 new tests cover both post-edge directions.
- [x] [Review][Decision→No change] Scorer attribution — RESOLVED (Pelo): "goal scorer is always the last player that touched the ball" — the existing `lastTouch` attribution already implements exactly that (kickoff possession guarantees a touch, so the `-1` fallback is unreachable); no code change.
- [x] [Review][Decision→Patch] `releasedBy` exemption too weak — RESOLVED (Pelo): exempt until out of radius. The releaser stays excluded from possession checks while `releasedBy` is set; the exemption expires once they are farther than COLLISION_RADIUS. 2 new tests (no re-collect within radius; teammate steals meanwhile).
- [x] [Review][Decision→Patch] Engine container ran as root — RESOLVED (Pelo): `USER node` + `chown -R node:node /app` added to the production stage of `deploy/docker/Dockerfile.node`; host bind-mount must be writable by uid 1000 (deployment spec concern). (Prod build tools stay — spec-mandated by Task 6.)
- [x] [Review][Patch] Sanitize `match_id` before path join [lachatadede-engine/src/routes/simulate.ts:24-31] — rejects `/`, `\`, `..` with 422; test added.
- [x] [Review][Patch] Validate seed range [lachatadede-engine/src/routes/simulate.ts:32-41] — integer in [0, 4294967295] enforced (PRNG state is 32-bit; larger values alias); boundary tests added.
- [x] [Review][Patch] Validate script actions + clamp positions [lachatadede-engine/src/engine/Simulation.ts:159-229] — non-finite action targets ignored, first action per slot wins (duplicates deduped), players clamped to [0,100]x[0,50] (dribbled ball follows).
- [x] [Review][Patch] Atomic frame-file write [lachatadede-engine/src/routes/simulate.ts:97-103] — temp file + `fs.rename`; no-partial-read test added.
- [x] [Review][Patch] Graceful shutdown [lachatadede-engine/src/index.ts:12-17] — SIGTERM/SIGINT handlers close the Fastify app before exit.
- [x] [Review][Patch] checkGoal constants [lachatadede-engine/src/engine/Simulation.ts:264-291] — imports GOAL_Y_MIN/GOAL_Y_MAX/FIELD_WIDTH/FIELD_HEIGHT instead of raw literals.
- [x] [Review][Patch] Validate PORT env [lachatadede-engine/src/index.ts:3-8] — integer in [1, 65535] required, clear startup error otherwise.
- [x] [Review][Patch] Add `lachatadede-engine/.dockerignore` — node_modules/dist/coverage/.git excluded from build context.
- [x] [Review][Patch] README output_path example [lachatadede-engine/README.md] — aligned with the `/app/storage` compose mount; documented match_id/seed constraints.
- [x] [Review][Patch] Replace `Math.hypot` with `Math.sqrt(dx*dx + dy*dy)` [lachatadede-engine/src/engine/BallState.ts, Simulation.ts] — correctly-rounded IEEE-754 math everywhere in the engine (AC2), cross-platform determinism hardened.
- [x] [Review][Defer] No run() deadline / ScriptRunner error-and-budget contract [lachatadede-engine/src/engine/ScriptRunner.ts:33-48] — deferred, pre-existing: belongs to Story 3.4 (isolated-vm); note Promise.race cannot protect a sync blocked loop.
- [x] [Review][Defer] Shuffled order does not order action application [lachatadede-engine/src/engine/Simulation.ts:155-161] — deferred, pre-existing: with the batch runTick interface the shuffle only consumes RNG; Story 3.4 must apply per-player execution in shuffled order (game-rules.md steps 1-3).
- [x] [Review][Defer] No auth/rate-limit/concurrency cap on POST /simulate [lachatadede-engine/src/routes/simulate.ts:80-113] — deferred, pre-existing: engine is internal-only today (no published ports); address with Story 3.5 Laravel wiring; note Fastify's 1MB default bodyLimit vs large scripts in 3.4.

Review verification: 66/66 tests pass (58 original + 8 review tests), `tsc` strict build clean, full match 7.6ms / 6.81MB frame file (NFR2 budget 2000ms).

## Dev Notes

- **Domain doc precedence:** epics.md's Story 3.3 says "30 fps / 5400 ticks" — that is SUPERSEDED by game-rules.md (validated by Pelo 2026-01-19): **60 fps, 10800 ticks**. PRD FR28 ("30 or 15 fps") left it open; game-rules.md closed it. Everything tick-related in Epic 3 assumes 60 fps. Keep `TICKS_PER_SECOND` as a single constant so the decision stays reversible in one line.
- **Determinism rules (hard):** no `Math.random()` anywhere (seeded PRNG only), no `Date.now()` inside the simulation loop, no `Set`/`Map` iteration-order dependence on insertion of numeric keys without explicit sort, seeded shuffle EVERY tick for player execution order (game-rules.md step 1), same operation order every tick. The determinism test (byte-equal output files) is the acceptance gate.
- **Contested possession:** when 2 players touch the free ball the same tick, seeded RNG decides (game-rules.md). With Noop scripts nothing moves, so cover this in 3.4's tests — but implement the rule NOW in `BallState`/`Simulation`.
- **Performance:** 10800 ticks × 10 players of pure math must complete well under 2s (NFR2) with Noop scripts — budget check in tests (`performance.now()` around run, assert < 2000ms).
- **Frame file size:** ~10800 frames ≈ 4-8MB JSON per match — fine for `GET /api/matches/{id}/frames` in 3.8; do not compress or truncate.
- The engine NEVER talks to MySQL and never trusts the client for positions: it receives final slot assignments + starting positions + script code from Laravel (backend-architecture.md flow).
- `state` values per frame: use `idle` (no action), `moving` (moveToward/dribble target set), `action` (shoot/stop). Replay renderer (3.7) maps state to visuals.
- TypeScript strict, English-only code/comments (repo rule). Node 24 (Dockerfile.node base is node:24-alpine — keep it).

### Simulation Response Contract (authoritative for 3.4/3.5)

```json
{
  "success": true,
  "file": "/storage/simulations/{match_id}.json",
  "result": { "score_challenger": 2, "score_opponent": 1, "duration_frames": 10800 }
}
```

Frame file top level: `{match_id, seed, total_frames, result: {score_challenger, score_opponent, winner: "challenger"|"opponent"|"draw"}, frames: [...]}`. `winner` derived from scores (draw allowed — game-rules.md).

### Previous Story Intelligence

- From deferred-work.md: `Game.runSimulation()` in the FRONTEND is a canned sine-wave animation with a TODO — Story 3.8 replaces its data source with real frames from this engine; do not "fix" the frontend here.
- deploy/docker-compose.yml already sets `GAME_ENGINE_URL=http://node:3001` for Laravel (unused until 3.5) — keep the variable name exactly.

### Project Structure Notes

- New tree (backend-architecture.md names it `lachatadede-engine/` — use exactly this):
  ```
  lachatadede-engine/
  ├── src/
  │   ├── index.ts              # Fastify server
  │   ├── routes/simulate.ts
  │   ├── engine/{Simulation,ScriptRunner,BallState,constants,types,seededRandom}.ts
  │   └── engine/__tests__/...
  ├── package.json, tsconfig.json, vitest.config.ts
  ```
- Update: `deploy/docker/Dockerfile.node`, `deploy/docker-compose.yml`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: Game Engine Core - Deterministic Simulation]
- [Source: _bmad-output/planning-artifacts/game-rules.md] (ALL physics/kickoff/constants — authoritative)
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Service Node.js (Game Engine) + Format Fichier JSON Frames]
- [Source: deploy/docker/Dockerfile.node] (placeholder to replace)
- [Source: src/components/canvas/engine/Game.ts:202] (canned simulation being replaced in 3.8)

## Dev Agent Record

### Agent Model Used

euria-code (Infomaniak), opencode CLI — 2026-09-13

### Debug Log References

- RED→GREEN cycle logs: health route test failed on missing `../app.js` (Task 1), constants/seededRandom missing modules (Task 2), `../Simulation.js` missing (Task 3), 6 route tests failing on stub (Task 4) — all resolved to green.
- 4 simulation test failures traced to same-tick possession re-grab: a shot/dropped ball was instantly re-collected by the releaser standing within COLLISION_RADIUS. Fix: `BallState.releasedBy` exempts the releaser from the first possession check after release (consumed after one check, cleared by `giveTo`/`reset`).
- Test payloads initially had opponents standing on the goal-mouth flight corridor at (95,25)/(80,25), intercepting crafted shots; dedicated `makeGoalTestPayload()` keeps all outfield players clear of the y=25 corridor.

### Completion Notes List

- **All 4 ACs satisfied.** 58 engine tests pass; `tsc` strict build clean; full Noop match runs in **7.8ms** (budget < 2000ms, NFR2) producing a **6.81MB** frame file (matches the 4-8MB estimate).
- AC1 Determinism: same seed → byte-identical JSON verified both at Simulation level (`JSON.stringify` equality) and through `POST /simulate` (`Buffer.compare` of two written files); different seeds → diverging trajectories (seeds picked with different kickoff teams via a deterministic test ScriptRunner).
- AC2: fixed tick loop 0..10799 (60 fps, 180s); `Math.random()`/`Date.now()` nowhere in engine code; mulberry32 PRNG validated against an independent reference implementation (1000 draws × 5 seeds).
- AC3: frame file written to `join(output_path, match_id + '.json')` (dir auto-created), format `{match_id, seed, total_frames, result{score_challenger, score_opponent, winner}, frames[]}`; winner derived from scores (draw allowed).
- AC4: `POST /simulate` validates payload (422 with problem list: match_id/seed/output_path/team sizes/slots/bounds/script types), runs simulation, writes file, responds synchronously; 500 `{success:false, error}` on internal failure; `GET /health` returns `{status:'ok'}`; server listens on `PORT` (default 3001) at host `0.0.0.0`.
- Kickoff: initial team decided by seed (`rng.next() < 0.5`); after a goal the conceding team receives possession (closest player to center, exact ties broken by seeded RNG); non-kickoff players pushed to the center-circle edge along their center→player direction (deterministic fallback for a player exactly at center).
- ScriptRunner: interface + `NoopScriptRunner` only (per story); `prepare(scripts)` receives all 10 `{slot, team, code}`; `runTick(tick, context)` gets a structural snapshot context (mutation-safe, verified by test). Contested possession (seeded shuffle of candidates) implemented now per Dev Notes, to be exercised by 3.4.
- Docker: production stage now uses a dedicated `build` stage (`npm ci` + `tsc`) and copies `dist/` into a slim runtime — fixes the placeholder Dockerfile which tried to run `tsc` after `npm ci --omit=dev` (TypeScript is a devDependency). Build deps (python3/make/g++) kept in the production stage for Story 3.4's isolated-vm. Compose `node` service: build context `../lachatadede-engine`, `restart: unless-stopped`, placeholder comments removed, storage mount unchanged. `GAME_ENGINE_URL=http://node:3001` untouched.
- `logs` in frames reserved for 3.4 (always `[]` in this story); frontend `Game.runSimulation()` untouched (replaced in 3.8 per deferred-work.md).
- Engine has its own `package-lock.json` (172 packages); Node 24 required (`engines.node >= 24`, matches `Dockerfile.node` base `node:24-alpine` and repo `.nvmrc`).

### File List

- lachatadede-engine/package.json (new)
- lachatadede-engine/package-lock.json (new, generated)
- lachatadede-engine/tsconfig.json (new)
- lachatadede-engine/vitest.config.ts (new)
- lachatadede-engine/README.md (new)
- lachatadede-engine/scripts/perf-check.ts (new)
- lachatadede-engine/src/index.ts (new)
- lachatadede-engine/src/app.ts (new)
- lachatadede-engine/src/routes/simulate.ts (new)
- lachatadede-engine/src/engine/constants.ts (new)
- lachatadede-engine/src/engine/seededRandom.ts (new)
- lachatadede-engine/src/engine/types.ts (new)
- lachatadede-engine/src/engine/BallState.ts (new)
- lachatadede-engine/src/engine/ScriptRunner.ts (new)
- lachatadede-engine/src/engine/Simulation.ts (new)
- lachatadede-engine/src/__tests__/app.test.ts (new)
- lachatadede-engine/src/routes/__tests__/simulate.test.ts (new)
- lachatadede-engine/src/engine/__tests__/constants.test.ts (new)
- lachatadede-engine/src/engine/__tests__/seededRandom.test.ts (new)
- lachatadede-engine/src/engine/__tests__/BallState.test.ts (new)
- lachatadede-engine/src/engine/__tests__/Simulation.test.ts (new)
- deploy/docker/Dockerfile.node (modified)
- deploy/docker-compose.yml (modified)

### Change Log

- 2026-09-13: Story 3.3 implemented — new deterministic Node.js game engine service `lachatadede-engine/` (Fastify, TypeScript strict, vitest node env) with seeded mulberry32 PRNG, 10800-tick simulation core (friction/rebound/goal/kickoff/contested-possession rules per game-rules.md), frame-file output + `/simulate`/`/health` HTTP contract, 58 unit tests (determinism byte-compare gate, physics, goals, kickoff, perf < 2s), Docker wiring (multi-stage Dockerfile.node, compose node service), engine README.
- 2026-09-13: Code review (gds-code-review, 3 adversarial layers) — 4 decisions resolved with Pelo (goal-line interpolation, scorer = last toucher [no change], release exemption until out of radius, USER node container) and 13 patches applied: match_id/seed/PORT validation, action finite-target guards + per-slot dedupe + field clamping, atomic frame-file write (tmp+rename), SIGTERM/SIGINT shutdown, goal-line crossing interpolation, checkGoal constants, .dockerignore, README alignment, Math.hypot → Math.sqrt (IEEE-754 determinism). Tests 58 → 66 (all green), tsc strict clean, perf 7.6ms. 3 items deferred to 3.4/3.5 (see deferred-work.md).
