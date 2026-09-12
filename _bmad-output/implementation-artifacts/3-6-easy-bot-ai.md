# Story 3.6: Easy Bot AI

Status: ready-for-dev

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

- [ ] Task 1: Bot scripts (5 JavaScript files as engine test fixtures + seeder strings, sharing one source of truth)
  - [ ] Store canonical bot scripts in `lachatadede-engine/src/engine/bots/easy/{goalkeeper,defender1,defender2,attacker1,attacker2}.js` (plain JS, canonical update(game) API from 3.4)
  - [ ] Goalkeeper: stay on goal line (x ≈ 5 home / 95 away), track ball Y clamped to [15,35], shoot clearances to a teammate when hasBall (adapt script-ia-api.md "Gardien" example)
  - [ ] Defenders: position between ball and own goal at fixed depth; chase ball when closest in own half; clear when hasBall (adapt "Defenseur Zone" example)
  - [ ] Attackers: chase ball when closest or ball in attack half; dribble toward goal when hasBall; shoot when within ~30 units of goal (adapt "Attaquant Simple" example)
  - [ ] No `Math.random` in bot code (determinism)
- [ ] Task 2: Seeder `SystemTacticSeeder`
  - [ ] Creates tactic `Easy Bot` with `is_system=true, user_id=null, is_public=true` + 5 `tactic_player` rows (slots 1-5, default positions per 3.2 constants) referencing the bot script contents
  - [ ] Bot scripts stored as `script_ia` rows owned by a dedicated system user OR code stored on tactic_player via script rows with nullable user — DECISION: create a `system@lachatadede.local` user owning them (avoids violating script_ia.user_id NOT NULL in the existing schema); idempotent seeder (`firstOrCreate`)
  - [ ] Register in `DatabaseSeeder`
- [ ] Task 3: MatchController bot resolution (completes 3.5's stub)
  - [ ] `bot: 'easy'` → resolve system tactic by `is_system=true AND name='Easy Bot'`; seed it in match row's `bot_tactic`
- [ ] Task 4: Engine exposes bot tactic loading for tests (optional but recommended)
  - [ ] Simulation tests: load easy bot JS files as the opponent scripts to enable behavioral tests without Laravel

### Testing Tasks

- [ ] Task 5: Engine behavioral tests (AC: #1, #3)
  - [ ] GK test: ball near goal → keeper within 12 units of own goal line majority of ticks
  - [ ] Defender test: ball in own half → defenders positioned between ball and goal (monotonic x-ordering check)
  - [ ] Attacker test: attacker with ball in shooting range → shoot action recorded in frames (state 'action' + ball velocity spike)
  - [ ] Predictability: two runs, same seed → identical bot behavior (already covered by determinism test, add assertion bots obey it)
- [ ] Task 6: Balance test (AC: #2)
  - [ ] Run StarterAI (extract the exact string from AuthController::STARTER_AI_CODE into a shared test fixture) vs Easy bot across 5 fixed seeds
  - [ ] Assert: starter scores ≥1 goal in ≥3 of 5 seeds; bot scores ≥1 goal in ≥3 of 5 seeds; neither side scores >8 in any seed (blowout guard)
  - [ ] If balance fails, tune bot constants (chase distance, shot range) — record final values in Completion Notes
- [ ] Task 7: Laravel feature test: practice match with `bot: 'easy'` resolves the seeded system tactic; seeder idempotency test

## Dev Notes

- Bot difficulty = "functional but simple". Use ONLY the canonical API (moveToward, dribble, stop, shoot, hasBall, isClosestToBall alias). Easy bot should be BEATABLE: slightly slow reactions are fine (e.g. only chase when `isClosestToBall()`), perfect play is wrong for AC #2.
- Bots live in the ENGINE repo as fixtures (source of truth for tests) AND in the seeder (source of truth for production). Export a TS constant/module from the engine (`bots/easy/index.ts` re-exporting file contents) and have the Laravel seeder consume a copied JSON or keep strings in PHP — pragmatic choice: keep ONE JSON file `lachatadede-engine/src/engine/bots/easy/scripts.json` read by both the engine tests and (copied into) the Laravel seeder; note the duplication point in Completion Notes if you choose PHP strings instead.
- script-ia-api.md examples use `me.team === 'home'` — engine maps challenger→home (3.4). Bots always play as 'away' from the user's perspective (user = challenger/home, orange — colors in 3.7).
- Positions for the bot tactic: use 3.2's slot geometry mirrored for away side (slot 1 GK x=92, DEF x=75, ATK x=40).
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

### Debug Log References

### Completion Notes List

### File List
