---
title: 'Match preview placement, bot scripts, GK axis, speed tuning'
type: 'bugfix'
created: '2026-09-15'
status: 'in-review'
baseline_commit: '0cfff47'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Practice-match replay is broken in four verified ways: (1) the renderer treats engine y (0–50) as percent (0–100) so all players/ball are squashed into the top half and the GK floats out of his goal, and the drawn goal mouth (35%–65%) misses the engine scoring zone (30%–70%); (2) the Easy Bot tactic in the DB holds empty stub scripts (`function update(game) {}`) because `ensureEasyBotTactic()` never refreshes existing rows, so bots never move (0 of 10,800 ticks); (3) the bot GK only y-shades toward the ball instead of defending the ball-owner→goal-center axis; (4) shots and players are too fast.

**Approach:** Four independent fixes delivered one at a time, each verified by Pelo before the next: frontend frame normalization + goal-mouth alignment; seeder content sync; GK axis-defense script; engine speed constants with rules-doc-first update.

## Boundaries & Constraints

**Always:**
- Frame y normalization happens once at load (players AND ball), leaving downstream consumers (sprites, timeline callbacks, debug panel) on percent coords.
- `ensureEasyBotTactic()` updates script rows IN PLACE; never recreate the tactic (matches reference its id).
- Bot script changes mirror to `bots/easy/scripts.json` AND `lachatadede-api/database/seeders/data/easy-bot-scripts.json` (sync-guarded by tests on both sides).
- Speed constants change in `game-rules.md` FIRST (contract doc), then `constants.ts` + all pinning tests in the same commit.
- Bot scripts stay deterministic (no Math.random/Date.now) and team-generic.

**Ask First:**
- If the balance test guards fail after speed changes: report results, do not silently re-tune bot constants.
- If goal-mouth rendering cannot be made to exactly cover the engine zone without visual regressions elsewhere.

**Never:**
- No engine/API changes for placement (formation data and hitbox are correct; it is purely a rendering bug).
- No narrowing of GOAL_WIDTH / scoring zone (rules change, out of scope).
- No new API endpoints or payload changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Replay frame y | Engine frame y=25 | Rendered at 50% of pitch height (pitch center) | N/A |
| Ball into drawn net | Ball crosses x=100 at y∈[15,35] | Visually enters the drawn goal; goal event fires | N/A |
| Ball outside posts | Crosses x=100 at y<15 or y>35 | Rebounds; no goal; visually hits the line outside the net | N/A |
| DB has stub scripts | `ensureEasyBotTactic()` on match create | Script codes updated in place to canonical JSON | N/A |
| DB already fresh | Content matches canonical | No writes (idempotent) | N/A |
| GK, ball owned | Owner at (60,10) (away) | GK targets y = projection of owner→(100,25) segment at x=95, clamped [15,35] | N/A |
| GK, ball free | No owner | GK tracks ball y via same projection from ball position | N/A |

</frozen-after-approval>

## Code Map

- `src/components/canvas/engine/Game.ts` -- `loadFrames()` (line ~356) is the single normalization choke point; `applyFrame` (~194) and `createMatchPlayers` (~405) consume frames downstream
- `src/components/canvas/engine/Field.ts` -- `drawMarkings` goal mouth `pitch.height * 0.3` (line ~325) → 0.4 (engine GOAL_WIDTH 20/50)
- `src/types/shared.ts` -- frame docs already say percent 0-100; stays accurate after normalization
- `lachatadede-api/app/Services/SystemTacticService.php` -- `ensureOnce()` returns early when tactic "complete" (line ~54) without comparing script code; canonical JSON read at line ~79
- `lachatadede-api/tests/Feature/Matches/EasyBotTest.php` -- seeder + engine-sync feature tests; add stale-content sync test here
- `lachatadede-engine/src/engine/bots/easy/goalkeeper.js` -- GK logic to rewrite (axis defense)
- `lachatadede-engine/src/engine/bots/easy/scripts.json` + `lachatadede-api/database/seeders/data/easy-bot-scripts.json` -- mirrors, sync-guarded (`EasyBot.test.ts:58-63`, `EasyBotTest.php`)
- `lachatadede-engine/src/engine/__tests__/EasyBot.test.ts` -- GK behavior tests (goal-line proximity, y clamp) + fixture sync; add axis-projection test
- `lachatadede-engine/src/engine/constants.ts` -- `MAX_BALL_SPEED=5.0` (line 28), `PLAYER_SPEED=1.0` (line 23); header requires game-rules.md-first changes
- `_bmad-output/planning-artifacts/game-rules.md` -- French rules doc; speed sections (~106-117) + constants block (~189-224)
- `lachatadede-engine/src/engine/__tests__/constants.test.ts`, `BallState.test.ts`, `Simulation.test.ts` -- pin exact values/displacements; update together
- `lachatadede-engine/src/engine/__tests__/EasyBotBalance.test.ts` -- 5-seed balance guards; re-run after speeds

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/matchFrames.ts` (new) -- pure `normalizeMatchFrames()`: y ×2 for players + ball; unit test -- single choke point, keeps Game.ts lean
- [x] `src/components/canvas/engine/Game.ts` -- call the normalizer inside `loadFrames()` -- all consumers get percent coords
- [x] `src/components/canvas/engine/Field.ts` -- goal mouth 0.3 → 0.4 -- drawn net exactly covers engine scoring zone
- [x] `app/Services/SystemTacticService.php` -- in `ensureOnce()`, when tactic exists, compare each slot's script code to canonical JSON and update rows in place before the completeness early-return -- self-heals stale DBs
- [x] `tests/Feature/Matches/EasyBotTest.php` -- add stale-stub sync test + idempotency assertion -- locks the fix
- [x] `tests/Feature/Matches/MatchTest.php` -- stub GK payload expectation → canonical goalkeeper code (fixture DB now simulates an outdated DB that gets healed)
- [x] `lachatadede-engine/src/engine/bots/easy/goalkeeper.js` -- axis-defense rewrite + `scripts.json` + API JSON mirror -- GK behavior per intent
- [x] `lachatadede-engine/src/engine/__tests__/EasyBot.test.ts` -- add GK axis-projection test -- locks behavior
- [x] `_bmad-output/planning-artifacts/game-rules.md` then `lachatadede-engine/src/engine/constants.ts` -- MAX_BALL_SPEED 5/1.75≈2.8571, PLAYER_SPEED 1/1.5≈0.6667 -- rules-doc-first contract
- [x] `constants.test.ts`, `BallState.test.ts`, `Simulation.test.ts`, `EasyBot.test.ts` (spike threshold 2.0→1.2) -- update pins -- suite stays green
- [x] `EasyBotBalance.test.ts` -- re-run; report guard outcomes -- no silent re-tuning

**Acceptance Criteria:**
- Given a completed practice match, when the replay plays, then both teams' players occupy sensible 1-2-2 kickoff positions, the GK stands inside the drawn goal, and goals only ever appear when the ball visually enters the net.
- Given a DB with stub bot scripts, when a practice match starts, then the bot team moves, contests, and shoots (scripts self-healed).
- Given the ball owned by an opponent at any position, when the bot GK decides, then it positions on the owner→goal-center axis within the mouth.
- Given the speed constants, when a full power shot fires, then first-tick displacement ≈2.86 units; a full-speed run moves ≈0.67 units/tick.

## Verification

**Commands:**
- `cd lachatadede-engine && npx vitest run` -- expected: all green (incl. balance across 5 seeds)
- `cd lachatadede-api && php artisan test --filter=EasyBotTest` -- expected: green incl. new sync tests
- `npm run test:unit && npx tsc --noEmit && npm run lint` (frontend) -- expected: green

**Manual checks:**
- Pelo verifies after EACH fix in the running app (Watch Replay): placement, bot movement, GK axis, game feel. Batch pauses between fixes by design.

## Spec Change Log

- 2026-09-15 (Pelo): ball speed reduced a FURTHER 20% beyond the original ÷1.75 -> game-rules.md v1.4 (`MAX_BALL_SPEED = 5/1.75 × 0.8 ≈ 2.2857`), constants + all pins re-derived. Avoids: stale pins / rules-doc drift. KEEP: rules-doc-first flow worked.
- 2026-09-15 (Pelo, "it is ok"): v1.4 outcomes accepted as-is (bistable: challenger walk-in metronomes 98-0 on seeds 11/227, sterile 0-0 elsewhere; full-speed ball can tunnel past the keeper because MAX_BALL_SPEED > COLLISION_RADIUS). Balance test converted from threshold guards to an exact per-seed characterization baseline. Avoids: permanently red suite / silent physics drift. KEEP: any future physics/bot/script change must consciously re-pin.
- 2026-09-15 (agent): sandboxed integration tests hardened against machine-load nondeterminism (relaxed `matchBudgetMs` alongside the existing relaxed tick deadline; perf bound now 0.9 × MATCH_TIME_BUDGET_MS instead of a stale 15s). Avoids: watchdog firing mid-match under parallel test load, breaking byte-determinism.
