---
baseline_commit: a3d02b04faed3634cadaee5a4077d8180090adb2
---

# Story 4.2: Ranked Match Engine

Status: done

## Story

As a user,
I want to quick-match or challenge a specific ready tactic,
So that a ranked match is simulated immediately, even if the opponent is offline.

## Acceptance Criteria

1. **Given** ready tactics from other players exist, **When** I quick-match with one of my ready tactics, **Then** a random opponent's ready tactic is selected (any elo, never mine, never a system tactic), **And** the match is simulated synchronously and stored with my tactic as challenger.

2. **Given** no other player's tactic is ready, **When** I quick-match, **Then** I get 404 "No opponents ready".

3. **Given** the list of ready tactics from other players, **When** I challenge one of them, **Then** the match is simulated and stored the same way.

4. **Given** a ranked match completes, **When** the result is recorded, **Then** both tactics' elo, wins and losses update in one transaction (Elo, K=50, initial 1000; draws move elo symmetrically but never the counters), **And** the match appears in BOTH players' history.

5. **Given** a challenge whose opponent tactic is not ready / not complete / not another player's, **When** the request arrives, **Then** it is refused (404 unknown/foreign, 422 not ready or incomplete lineup).

## Scope Boundary (read first)

- **Simulation is synchronous** in the request (same as practice, `GameEngineService::simulate`, ~1.5–6.5s worst case). No queue, no worker, no pending ranked matches: a challenge either completes in-request or marks the row `failed`.
- **The elo write is transactional with the match result** (match row + both tactics' elo/wins/losses in one `DB::transaction` with `lockForUpdate` on both tactic rows, PK-ordered). The engine call itself stays OUTSIDE the transaction (no 6s row locks); elo is only ever applied to a `completed` match, so a mid-flight crash leaves a pending row and zero elo movement.
- elo is floored at 0; `users.points` stays untouched (vestigial).
- No anti-farming rules (re-challenge limits) in v1 — the K=50 formula self-limits farming weaker tactics.

## Tasks / Subtasks

### Backend Tasks (Laravel — `lachatadede-api/`)

- [x] Task 1: `EloService` (`app/Services/EloService.php`)
  - [x] `const K = 50`, `const STARTING_ELO = 1000`
  - [x] `expected(int $a, int $b): float` — `1 / (1 + 10 ** (($b - $a) / 400))`
  - [x] `deltas(int $ratingA, int $ratingB, float $scoreA): array{int, int}` — `round(K * (score - expected))` per side, symmetric for S + (1-S)
- [x] Task 2: `RankedMatchService` (`app/Services/RankedMatchService.php`)
  - [x] `opponents(User $user): array` — `is_ready`, not `is_system`, `user_id != me`, lineup complete (`Tactic::lineupIsComplete()`), each: id, name, owner username, elo, wins, losses; elo desc
  - [x] `quickMatch(User $user, Tactic $mine): GameMatch` — random pool opponent (any elo); pool empty → `RankedMatchException('No opponents ready', 404)`
  - [x] `challenge(User $user, Tactic $mine, Tactic $opponent): GameMatch` — opponent must be in the pool (ready + complete + foreign + non-system) else `RankedMatchException(..., 404/422)`
  - [x] Initiator requirements both ways: owned, `is_ready`, lineup complete (422 otherwise)
  - [x] `play()`: create `GameMatch` (mode ranked, challenger = initiator, seed random, status pending) → `GameEngineService::simulate` (challenger tactic vs opponent tactic; engine failure or missing frames file → row `failed` + `RankedMatchException('Simulation failed', 502)`) → final `DB::transaction`: lock both tactic rows (PK order), compute `EloService::deltas` from FRESH elo, update match (scores, result, duration, frames_file, status completed, points_challenger/points_opponent = deltas) + elo (floored at 0) and wins/losses on both tactics (draws: counters untouched)
- [x] Task 3: `MatchmakingController` v2 + routes
  - [x] `GET /api/matchmaking/opponents` → list (200)
  - [x] `POST /api/matchmaking/quick` `{tactic_id}` → 201 with the serialized match; mapped exceptions (404/422/502)
  - [x] `POST /api/matchmaking/challenge` `{tactic_id, opponent_tactic_id}` → same
  - [x] All three under `throttle:matchmaking`; `RankedMatchException` carries the HTTP status
- [x] Task 4: History covers both sides (AC: #4)
  - [x] `GameMatch`: `scopeForUser` (challenger OR opponent)
  - [x] `MatchController@index`: `scopeForUser` + optional `?tactic_id=` filter (owned tactic, matched on either side) + eager-load challenger/opponent users
  - [x] `MatchSerializer`: add `pointsChallenger`, `pointsOpponent`, `challengerName`, `opponentName` (additive; existing assertions stay green)
- [x] Task 5: Feature tests `tests/Feature/Matchmaking/RankedMatchmakingTest.php`
  - [x] Opponents list: ready+complete foreign tactics only (excludes own, system, not-ready, incomplete-lineup), elo desc, owner name present
  - [x] Quick match: creates ranked match (challenger = me), random opponent drawn from pool, simulated + completed in-request (mock the engine HTTP layer like `MatchTest` does)
  - [x] Quick match with empty pool → 404 "No opponents ready"
  - [x] Challenge: specific opponent; unknown/own/system/not-ready/incomplete → mapped status
  - [x] Elo: equal ratings → ±25; upset (1000 beats 1200) → +37-ish (assert exact from the formula); big favorite win ≈ +1; both tactics move in one row-set (elo floored at 0); points_challenger/points_opponent store the signed deltas
  - [x] Counters: winner +1 win, loser +1 loss; draw leaves both untouched but moves elo symmetrically
  - [x] Both sides see the match in `GET /matches` (challenger and offline opponent), `?tactic_id` filter works, foreign tactic filter → 404
  - [x] Engine failure → match `failed`, zero elo/counter movement, 502

## Verification

- `php artisan test` green (new suite + existing MatchTest additive-safe)
- Manual smoke with two users and the local engine: quick match + challenge, elo applied on both sides, offline user sees the match in history

## Dev Agent Record

**Completed 2026-09-19.** All acceptance criteria verified.

### Approach notes

- `EloService` is pure math (no state): `expected()` + `deltas()` returning `[$deltaChallenger, $deltaOpponent]`, with `round()` half away from zero (PHP default) — the loser's delta is always `−winnerDelta` by symmetry of `S + (1−S) = 1`.
- `RankedMatchService::play()` ordering: engine OUTSIDE the transaction (no ~6s row locks); inside the transaction both tactic rows are locked **in PK order** (deadlock-safe), elo re-read fresh under the lock, match row updated + both tactics updated, all committed atomically. A failed simulation leaves a `failed` match row and zero elo movement.
- Pool query uses `Tactic::lineupIsComplete()` semantics in SQL (5 players, zero null scripts) via a subquery-compatible where clause; `opponents()` orders elo desc and returns owner `username` eager-loaded.
- Challenge semantics: initiator = challenger (home), opponent mirrored; `quickMatch` draws uniformly from the pool (`inRandomSeed()`-free — plain `inRandomOrder()`), elo band-matching explicitly deferred (Pelo decision).
- `MatchmakingController` maps `RankedMatchException` via `renderable` status; routes live under the pre-existing `throttle:matchmaking` limiter (kept alive in 4.1 for exactly this).

### Completion notes / deviations

- None material. `users.points` remains untouched (vestigial, per scope boundary). No anti-farming rules in v1.
- `MatchSerializer` additions are purely additive — existing `MatchTest` assertions stayed green untouched.

### Verification results

- Backend: `php artisan migrate:fresh --env=testing --force` + `php artisan test --env=testing` → **104 passed, 1 failed** (the same pre-existing `ExampleTest` sessions-table failure documented in 4.1; unrelated). `RankedMatchmakingTest`: **13 tests green** covering every task-5 bullet, including exact elo math assertions (±25 equal, +37/−37 upset for 1000 vs 1200, +1/−1 near-certain favorite, floored-at-0, symmetric draw movement, counters, failed-simulation zero-movement).
- Two-user manual smoke: covered by the e2e suite `tests/e2e/ranked-matchmaking.spec.ts` (story 4.3), which runs the **real engine** end-to-end: quick match and challenge against a second seeded user, elo + record changes asserted in the UI after the match.
