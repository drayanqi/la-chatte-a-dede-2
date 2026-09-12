# Story 3.3: Game Engine Core — Deterministic Simulation

Status: ready-for-dev

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

- [ ] Task 1: Scaffold `lachatadede-engine/` (AC: #4)
  - [ ] package.json (type: module, TypeScript ~5.6, strict), tsconfig, vitest config (environment: node — NOT jsdom), scripts: `dev` (tsx watch), `build` (tsc → dist/), `test`
  - [ ] Fastify server `src/index.ts`: listens `PORT` env (default 3001) on host `0.0.0.0` (Docker requirement), `POST /simulate` route, `GET /health` route
- [ ] Task 2: Constants + seeded RNG (AC: #1, #2)
  - [ ] `src/engine/constants.ts` — copy EXACT values from game-rules.md: FIELD_WIDTH 100, FIELD_HEIGHT 50, GOAL_Y_MIN 15, GOAL_Y_MAX 35, CENTER_CIRCLE_RADIUS 10, PLAYER_SPEED 1.0, PLAYERS_PER_TEAM 5, MAX_BALL_SPEED 5.0, BALL_FRICTION 0.95, MIN_BALL_SPEED 0.1, COLLISION_RADIUS 2.0, TICKS_PER_SECOND 60, MATCH_DURATION_SECONDS 180, TOTAL_TICKS 10800
  - [ ] `src/engine/seededRandom.ts` — integer-based PRNG (mulberry32), seeded from the payload `seed`; expose `next()`, `range(min,max)`, `shuffle(array)`; the ONLY randomness source in the engine
- [ ] Task 3: Simulation core (AC: #1, #2)
  - [ ] `src/engine/types.ts` — payload/response/frame types per backend-architecture.md contract (below)
  - [ ] `src/engine/Simulation.ts` — main loop per game-rules.md "Sequence de Jeu": init positions from payload tactics → per tick: seeded shuffle of execution order → collect actions from ScriptRunner → apply actions → update positions → ball possession check (COLLISION_RADIUS 2.0) → ball physics (friction ×0.95/tick, stop under 0.1) → edge rebounds (y=0/50 reflect vy; x=0/100 reflect vx when outside goal mouth) → goal check (x≤0 or x≥100 with y in [15,35]) → kickoff reset after goal (all players to initial positions, ball to center (50,25), conceding team gets possession, opponents pushed out of center circle) → record frame
  - [ ] `src/engine/BallState.ts` — ball physics: velocity, friction, rebounds with position clamped 0.1 inside walls, owner tracking (slot+team), lost on moveToward, released on shoot
  - [ ] `src/engine/ScriptRunner.ts` — INTERFACE ONLY in this story: `prepare(scripts)`, `runTick(tick, context) => {actions, logs}`; provide a `NoopScriptRunner` (no actions, no logs) so 3.3 is fully testable; Story 3.4 delivers the isolated-vm implementation
  - [ ] Frame recording: `{index, ball: {x,y}, players: [{slot, team, x, y, state}], events: [], logs: []}` — `logs` reserved (filled in 3.4), `events` records `{type:'goal', team, scorerSlot}` entries
  - [ ] Player state machine: `idle` | `moving` | `action` — actions set state for that tick
- [ ] Task 4: File output + response (AC: #3, #4)
  - [ ] Write JSON to `join(payload.output_path, payload.match_id + '.json')` — create directory if missing
  - [ ] Response 200: `{success: true, file, result: {score_challenger, score_opponent, duration_frames: 10800}}`; response 422 on invalid payload; response 500 with `{success: false, error}` on internal failure
  - [ ] `POST /simulate` payload (accept and validate): `{match_id, seed, output_path, challenger: {players: [{slot, x, y, script}]}, opponent: {players: [...]}}` — `script` may be empty string in this story (Noop runner)
- [ ] Task 5: Engine unit tests (AC: #1, #2, #3)
  - [ ] Determinism: run 2 simulations same seed → deep-equal JSON files (byte-compare); 2 different seeds → differing trajectories
  - [ ] Ball physics: friction sequence 5.0 → 4.75 → 4.51…, stop below 0.1, rebound reflection examples copied from game-rules.md (exact expected positions)
  - [ ] Goal detection: x≥100 & y∈[15,35] scores for challenger; y outside range rebounds
  - [ ] Kickoff: after goal, positions reset, ball at (50,25), conceding team possession; initial kickoff decided by seed
  - [ ] Full match = exactly 10800 frames, duration_frames = 10800

### Deployment Tasks

- [ ] Task 6: Wire Docker (AC: #4)
  - [ ] Update `deploy/docker/Dockerfile.node`: build context becomes `lachatadede-engine/`, install build deps (python3 make g++) — Story 3.4 adds isolated-vm which needs them — `npm ci && npm run build`, CMD `node dist/index.js`
  - [ ] Update `deploy/docker-compose.yml` node service: correct build context, `restart: unless-stopped`, remove the "will fail until Epic 3" placeholder comment; shared `./storage` volume mount stays (engine writes there via output_path)
  - [ ] Local dev documented in engine README: `npm run dev` (tsx watch, port 3001)

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

### Debug Log References

### Completion Notes List

### File List
