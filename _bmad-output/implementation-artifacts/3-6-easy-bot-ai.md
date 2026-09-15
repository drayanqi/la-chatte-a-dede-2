---
baseline_commit: d47d758b4dd7a761fcb9f4cea41d514380b9e1d7
---

# Story 3.6: Easy Bot AI

Status: done (Tasks 1-7 complete; Task 6 balance green with blowout guard relaxed to 10 by Pelo — see Completion Notes)

## Story

As a user,
I want to practice against a functional bot,
So that I can test my strategies.

## Acceptance Criteria

1. **Given** I start a practice match, **When** the Easy bot plays, **Then** it demonstrates basic competent behavior: goalkeeper stays near goal, defenders position between ball and goal, attackers move toward ball and shoot.

2. **Given** my starter AI plays against Easy bot, **When** the match completes, **Then** my starter AI has a reasonable chance to score, **And** Easy bot scores but is beatable.

3. **Given** Easy bot, **When** it makes decisions, **Then** its behavior is predictable enough to learn from (no randomness in bot logic — only seeded contest decisions from the engine).

## Tasks / Subtasks

### Backend Tasks (Laravel + Engine scripts)

- [x] Task 1: Bot scripts (5 JavaScript files as engine test fixtures + seeder strings, sharing one source of truth)
  - [x] Store canonical bot scripts in `lachatadede-engine/src/engine/bots/easy/{goalkeeper,defender1,defender2,attacker1,attacker2}.js` (plain JS, canonical update(game) API from 3.4)
  - [x] Goalkeeper: stay on goal line (x ≈ 5 home / 95 away), track ball Y clamped to [15,35], shoot clearances to a teammate when hasBall (adapt script-ia-api.md "Gardien" example)
  - [x] Defenders: position between ball and own goal at fixed depth; chase ball when closest in own half; clear when hasBall (adapt "Defenseur Zone" example)
  - [x] Attackers: chase ball when closest or ball in attack half; dribble toward goal when hasBall; shoot when within ~30 units of goal (adapt "Attaquant Simple" example)
  - [x] No `Math.random` in bot code (determinism)
- [x] Task 2: Seeder `SystemTacticSeeder`
  - [x] Creates tactic `Easy Bot` with `is_system=true, user_id=null, is_public=true` + 5 `tactic_player` rows (slots 1-5, default positions per 3.2 constants) referencing the bot script contents
  - [x] Bot scripts stored as `script_ia` rows owned by a dedicated system user OR code stored on tactic_player via script rows with nullable user — DECISION: create a `system@lachatadede.local` user owning them (avoids violating script_ia.user_id NOT NULL in the existing schema); idempotent seeder (`firstOrCreate`)
  - [x] Register in `DatabaseSeeder`
- [x] Task 3: MatchController bot resolution (completes 3.5's stub)
  - [x] `bot: 'easy'` → resolve system tactic by `is_system=true AND name='Easy Bot'`; seed it in match row's `bot_tactic`
- [x] Task 4: Engine exposes bot tactic loading for tests (optional but recommended)
  - [x] Simulation tests: load easy bot JS files as the opponent scripts to enable behavioral tests without Laravel

### Testing Tasks

- [x] Task 5: Engine behavioral tests (AC: #1, #3)
  - [x] GK test: ball near goal → keeper within 12 units of own goal line majority of ticks
  - [x] Defender test: ball in own half → defenders positioned between ball and goal (monotonic x-ordering check)
  - [x] Attacker test: attacker with ball in shooting range → shoot action recorded in frames (state 'action' + ball velocity spike)
  - [x] Predictability: two runs, same seed → identical bot behavior (already covered by determinism test, add assertion bots obey it)
- [x] Task 6: Balance test (AC: #2) — green after the engine v1.2 tick-order fix (Pelo-validated) + bot tuning
  - [x] Run StarterAI (extract the exact string from AuthController::STARTER_AI_CODE into a shared test fixture) vs Easy bot across 5 fixed seeds
  - [x] Assert: starter scores ≥1 goal in ≥3 of 5 seeds; bot scores ≥1 goal in ≥3 of 5 seeds; neither side scores >8 in any seed (blowout guard) — guard relaxed to 10 by Pelo (2026-09-15), see Completion Notes
  - [x] If balance fails, tune bot constants (chase distance, shot range) — record final values in Completion Notes
- [x] Task 7: Laravel feature test: practice match with `bot: 'easy'` resolves the seeded system tactic; seeder idempotency test

## Dev Notes

- Bot difficulty = "functional but simple". Use ONLY the canonical API (moveToward, dribble, stop, shoot, hasBall, isClosestToBall alias). Easy bot should be BEATABLE: slightly slow reactions are fine (e.g. only chase when `isClosestToBall()`), perfect play is wrong for AC #2.
- Bots live in the ENGINE repo as fixtures (source of truth for tests) AND in the seeder (source of truth for production). Export a TS constant/module from the engine (`bots/easy/index.ts` re-exporting file contents) and have the Laravel seeder consume a copied JSON or keep strings in PHP — pragmatic choice: keep ONE JSON file `lachatadede-engine/src/engine/bots/easy/scripts.json` read by both the engine tests and (copied into) the Laravel seeder; note the duplication point in Completion Notes if you choose PHP strings instead.
- script-ia-api.md examples use `me.team === 'home'` — engine maps challenger→home (3.4). Bots always play as 'away' from the user's perspective (user = challenger/home, orange — colors in 3.7).
- Positions for the bot tactic: use 3.2's slot geometry mirrored for away side (slot 1 GK x=92, DEF x=75, ATK x=60 — ATK 40 → 60 because home ATK moved to x=40 in the corrected left-half kickoff geometry).
- Do NOT make the bot smart (no passing networks, no interceptions prediction) — that's a post-MVP difficulty.
- Architecture compliance: English-only code/comments. Bot scripts are user-facing artifacts — their comments may be shown nowhere, keep them minimal and English.

### Test Selectors

No UI. Balance tests assert on generated frame files (parse JSON, inspect scores/events).

### Previous Story Intelligence

- From 3.4: canonical API + aliases available in-sandbox; warnings (`DRIBBLE_NO_BALL`, `SHOOT_NO_BALL`) must NOT appear for bots — bots respect possession rules or tests should catch it (add assertion: zero warn-level logs from bot players in a clean run).
- From 3.5: MatchController has a seeder-stub resolution for the bot — this story replaces it with the real system tactic; remove the stub.
- From 1.4: starter AI promise is "works against Easy bot" — the balance test (Task 6) is the enforcement of FR10; treat a red balance test as an AC failure, not flaky.

### Project Structure Notes

- New: `lachatadede-engine/src/engine/bots/easy/*` (5 scripts + index/scripts.json)
- New: `lachatadede-api/database/seeders/SystemTacticSeeder.php`, optional `system` user handling
- Update: `lachatadede-api/app/Http/Controllers/MatchController.php` (bot resolution), `database/seeders/DatabaseSeeder.php`
- Update: `tests/e2e/practice-match.spec.ts` only if bot seeding affects setup (should not)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6: Easy Bot AI]
- [Source: _bmad-output/planning-artifacts/script-ia-api.md#Exemples de Scripts] (Gardien / Defenseur / Attaquant — adapt, don't copy blindly)
- [Source: _bmad-output/planning-artifacts/game-rules.md#Engagement Apres But] (possession/kickoff context)
- [Source: _bmad-output/implementation-artifacts/3-4-script-sandboxing-and-execution.md] (canonical API)

## Dev Agent Record

### Agent Model Used

### Implementation Plan

- Engine: 5 canonical plain-JS bot scripts in `lachatadede-engine/src/engine/bots/easy/*.js` + `index.ts` (reads the .js files, exports slot-ordered scripts + away-side lineup for tests) + `scripts.json` (JSON mirror consumed by the Laravel seeder; engine test guards .js <-> scripts.json sync).
- Bot scripts are team-generic (`me.team === 'home' ? ... : ...`, adapting script-ia-api.md examples); slot drives defender bands ([5,25] / [25,45]) and attacker anchors (y 15 / 35). No Math.random/Date.now.
- Positions: tactic rows stored home-side (3.2 geometry: GK 8/25, DEF 25/15, 25/35, ATK 40/15, 40/35); GameEngineService mirrors the bot tactic (x -> 100-x), giving the story's away-side 92/75/60 on the pitch. Engine tests use the away-side values directly.
- API: `App\Services\SystemTacticService::ensureEasyBotTactic()` holds the shared idempotent creation logic (seeder, MatchController resolution, on-demand fallback for unseeded E2E DBs — preserving 3.5 behavior). System user `system-bot@lachatadede.local` owns the 5 scripts (scripts.user_id NOT NULL).
- StarterAI fixture: `lachatadede-engine/src/engine/bots/starter-ai.js` — exact copy of AuthController::STARTER_AI_CODE (no AuthController change; drift noted in Completion Notes).
- Tests: engine `EasyBot.test.ts` (fixture sync, no-random, GK/DEF/ATK behavior, zero bot warnings, same-seed determinism) + `EasyBotBalance.test.ts` (StarterAI vs Easy Bot, 5 fixed seeds). API `tests/Feature/Matches/EasyBotTest.php` (seeder shape + idempotency, match resolution, on-demand creation, engine-sync guard).

### Debug Log References

- Task 6 blocker (pinned-ball emergent behavior), reproduced with the final bot scripts:
  `EasyBotBalance.test.ts` across seeds [11, 227, 3457, 60221, 987654] → every match ends **0-0**:
  `seed 11: 0-0 (draw), seed 227: 0-0 (draw), seed 3457: 0-0 (draw), seed 60221: 0-0 (draw), seed 987654: 0-0 (draw)`.
- Root cause chain (verified against Simulation.ts/BallState.ts, per game-rules.md):
  1. Both AIs chase the ball carrier (StarterAI always chases; bot chases when in attack half or closest) → the pack compacts onto the carrier within ~30-80 ticks and stays glued at ~1 unit (PLAYER_SPEED snap).
  2. Every possession release (moveToward drop or shoot) triggers `checkPossession` the SAME tick with the ball still at the release point → any of the 2-4 pack players within COLLISION_RADIUS 2.0 instantly re-collects (the shooter is exempt via `releasedBy`, but the pack around it is not) → the ball never escapes the pile.
  3. A carried ball can only advance while the carrier dribbles; at the shooting boundary (~x=29.4 / x=70.3 for a 30-unit shot range) the carrier must release → nullified → ball oscillates between the boundaries forever.
  4. Walk-in designs (dribble into the goal mouth, never release) DO score — but then the bot also walks in repeatedly: blowouts (20+ goals), violating the same AC.
- Measured mitigation attempts (all × 5 seeds): DEF chase on/off; ATK chase none/closest/half/closest-or-half; shot ranges 30/35/40/45/50; clearance powers 0.6/0.8/1.0 → **every configuration 0-0** (walk-ins: blowouts). Bot-constant tuning cannot satisfy Task 6; the nullification mechanic is engine-level (game-rules.md spec, validated by Pelo).
- Additional idle-state hazard (no action needed for this story): an idle owner parks the ball forever (sticky possession, no contest on owned balls) — an E2E-style idle-vs-idle match is a permanent 0-0.

### Completion Notes List

- Resolution of the Task 6 blocker: Pelo approved an engine v1.2 change (game-rules.md "Ballon libéré voyage d'abord"): in `Simulation.stepTick()` the ball physics step now runs BEFORE the possession check, so a released ball travels before it can be re-collected (shooter lockout/`releasedBy` unchanged). This removed the same-tick re-collection pin; the Simulation.test.ts lunge test was rewritten to pin the new order.
- Final bot constants (post-v1.2 tuning grid, ~25 measured configurations across seeds 11/227, finalists on all 5): GK holds x=95/5 and shades 40% of the way from the goal centre toward the ball (y clamped [15,35]), clears short toward midfield at (68, 26) power 0.9; DEF slot 2 holds depth x=80/20 with band [5,25], chases only in the own half when closest, clears to (68, 32) power 0.9; DEF slot 3 posts (80, 30) without tracking, clears to (68, 18) power 0.9; ATKs (identical files, slot 4 anchor y=15 / slot 5 anchor y=35 at x=60 away / 40 home) chase ONLY once the ball is already deep in the attacking third (ball x < 35 away / > 65 home — no isClosestToBall chase), dribble toward (attack goal x, 25) at 0.8 multiplier, and shoot at the near corner (attack goal x, ball.y ≤ 25 ? 16 : 34) power 0.45 from inside 11 units.
- Balance outcome (EasyBotBalance.test.ts, exact): seed 11: 2-8, seed 227: 2-8, seed 3457: 2-8, seed 60221: 2-10, seed 987654: 3-10 — starter scores in 5/5, bot scores in 5/5. Blowout guard relaxed from 8 to 10 (Pelo, 2026-09-15: "since bots can score some goals, it will be enough for now — doesn't need to be perfect"): the engine's bistable attractors cap every both-sides-score configuration at 10 on seeds 60221/987654 (≤8 configs collapse to 0-0 sterile or one-sided metronomes). The guard constant lives in EasyBotBalance.test.ts (blowoutGuard = 10) with the decision in a comment.
- Task 5 note: the attacker shoot test uses a crafted isolated scenario (away slot-4 attacker starts in possession at x=12 — one dribble outside the 11-unit range — everyone else parked far) because in a full StarterAI match most shots are re-collected. The spike threshold is 2.0 (a 0.45-power shot moves the ball 2.25 in its first tick, above the 1.0 run / 0.8 dribble displacements). In-match shooting (state 'action' + ball spike) is still exercised: the crafted run records the shoot tick exactly as the engine would.
- Duplication points: (1) `database/seeders/data/easy-bot-scripts.json` is a copy of `lachatadede-engine/src/engine/bots/easy/scripts.json` — guarded in both directions by the engine-sync test (`EasyBotTest.php` <-> `EasyBot.test.ts`). (2) `starter-ai.js` is a byte-copy of AuthController::STARTER_AI_CODE (AuthController untouched); drift would only affect the balance test, not production. (3) `fakeEngineSuccess()` is duplicated from MatchTest (kept inline to avoid refactoring 3.5's test).
- Seeder resolution lives in `App\Services\SystemTacticService::ensureEasyBotTactic()` (shared by SystemTacticSeeder, MatchController, and the on-demand path for unseeded E2E DBs — 3.5 behavior preserved: lockForUpdate + completeness check + partial-tactic rebuild + UniqueConstraintViolationException retry). MatchController's 3.5 stub methods were removed. Script rows: names EasyBot-{Goalkeeper,Defender1,Defender2,Attacker1,Attacker2}, is_valid=true, owned by system user system-bot@lachatadede.local (username EasyBot); tactic 'Easy Bot' is_system=true, is_public=true, user_id=null.
- Verification (final): engine `npx tsc --noEmit` clean; engine suite 134 passed / 0 failed (includes the green Task 6 balance test and the re-synced scripts.json guard); API suite 84 passed / 0 failed. `scripts.json` and the Laravel copy `database/seeders/data/easy-bot-scripts.json` were regenerated from the canonical .js files after tuning.

### File List

- lachatadede-engine/src/engine/bots/easy/goalkeeper.js (new — Task 1)
- lachatadede-engine/src/engine/bots/easy/defender1.js (new — Task 1)
- lachatadede-engine/src/engine/bots/easy/defender2.js (new — Task 1)
- lachatadede-engine/src/engine/bots/easy/attacker1.js (new — Task 1)
- lachatadede-engine/src/engine/bots/easy/attacker2.js (new — Task 1)
- lachatadede-engine/src/engine/bots/easy/scripts.json (new — Task 1, seeder transfer artifact)
- lachatadede-engine/src/engine/bots/easy/index.ts (new — Task 4)
- lachatadede-engine/src/engine/bots/starter-ai.js (new — Task 6 fixture, AuthController copy)
- lachatadede-engine/src/engine/__tests__/EasyBot.test.ts (new — Task 5)
- lachatadede-engine/src/engine/__tests__/EasyBotBalance.test.ts (new — Task 6, currently red by design)
- lachatadede-api/database/seeders/data/easy-bot-scripts.json (new — Task 2, copy of engine scripts.json)
- lachatadede-api/app/Services/SystemTacticService.php (new — Task 2/3)
- lachatadede-api/database/seeders/SystemTacticSeeder.php (new — Task 2)
- lachatadede-api/database/seeders/DatabaseSeeder.php (modified — Task 2: registers SystemTacticSeeder)
- lachatadede-api/app/Http/Controllers/MatchController.php (modified — Task 3: delegates to SystemTacticService, 3.5 stub removed)
- lachatadede-api/tests/Feature/Matches/EasyBotTest.php (new — Task 7)
