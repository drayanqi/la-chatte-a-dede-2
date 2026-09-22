---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 7.9: Engine Telemetry & Stats Tab v2

Status: ready-for-dev
Design source: planning-artifacts/stadium-mockup-ronde-replay-stats-s1-tableau-de-bord.html (S1 "Tableau de bord", validated by Pelo)
Depends on: 7.7 Task 3 (drawer shell + ghost states shipped)

## Story

As a player,
I want the replay drawer fed by real engine statistics,
So that the stats panel tells me WHY I lost, not just by how much.

## Background (locked in party session 2026-09-22)

- Pelo chose rich engine-generated stats over the honest-aggregate-only drawer ("oui samus, je veux ça").
- Pelo's law on turnovers: a RÉCUP counts ONLY when the ball changes CAMP (team → other team). A teammate pickup is possession continuing, never a recovery.
- The engine's raw signals already exist: `PlayerAction` = moveToward | dribble | shoot(power) | stop (`lachatadede-engine/src/engine/types.ts:108-112`), ball ownership tracked continuously (`BallState.ts`), `events` currently emit only `goal` (`types.ts:56`).

## Acceptance Criteria

1. **Given** a simulation run, **When** the engine executes, **Then** telemetry counters accumulate as pure observation — incremented at existing routing points (`Simulation.applyAction`, BallState ownership changes), never read by decision logic (determinism law), O(1) per tick (60fps law).
2. **Given** ball possession, **When** counted, **Then** possession = ticks where the ball owner belongs to each team (engine truth, not proximity heuristics); **and** a `turnover` is recorded ONLY when the owner's team changes camp (teammate pickup excluded — Pelo's law).
3. **Given** player actions, **When** counted, **Then** shots (shoot while owning) + shots on target, dribbles, and distance per player (movement integral) are tracked per team and per slot.
4. **Given** a shot or camp-change turnover, **When** it happens on a tick, **Then** an enriched event (`shot` / `turnover`, same frame-event shape as `goal`) is emitted for the drawer's frame-linked rows.
5. **Given** the frames file, **When** the engine writes it, **Then** a `stats` block sits in the header next to `result` (single source of truth, no new endpoint, no client re-derivation).
6. **Given** the drawer's Stats tab, **When** a replay WITH telemetry loads, **Then** the S1 sections come alive: possession bar + sparkline (goal dots + playhead), mirrored tirs/récups/dribbles rows, distance ranking per player; shots and goals click → seek to frame.
7. **Given** an old replay without a stats block, **When** loaded, **Then** the drawer degrades gracefully to the current ghost states ("à venir") — no crash, no zeros presented as truth, no retro re-simulation promised (engine version evolves; seeds only re-sim identically at equal engine version).
8. **Given** the determinism suite, **When** the same seed runs twice, **Then** the output is byte-identical with stats included; a 50/50 ball-contention storm cannot make turnover counters explode (test asserted).

## Scope Boundary

- Engine owns truth; the API serves the file untouched; the client renders — no stats math in Laravel or React.
- No xG or any modeled metric (Winston: "voyance habillée en science") — engine-defined events only.
- No client-side derivation of possession from positions (banned as "invented numbers" by 7.7).
- Sparkline playhead sync + possband under the scrubber (S2 idea) may land as a 7.9 polish item or follow-up — not the AC spine.

## Tasks / Subtasks

- [x] Task 1: Engine telemetry accumulator — `Telemetry.ts` (possession ticks per team via BallState owner truth, shots + on-target, turnovers CAMP-ONLY per Pelo's law, dribbles with-ball-only, distance per player); O(1)/tick, observation-only, arrays for player rows (determinism)
- [x] Task 2: Enriched frame events — `ShotEvent` (with honest onTarget verdict), `TurnoverEvent` (team/takerSlot/fromTeam) in the `FrameEvent` union
- [x] Task 3: `stats` block in frames file header (teams + players + possessionTimeline per 300-tick bin = challenger share %)
- [x] Task 4: Determinism guard — existing byte-identity tests now cover the stats block (asserted `"stats"` present in compared payload); turnover-storm test (10 players stacked, 600 ticks: bounded counters, no explosion); on-target = direct trajectory with friction (full-power from midfield honestly dies ~1.4 units SHORT of the line — the tests pin this)
- [x] Task 5: Client types + drawer v2 — `MatchStats` types, matchStore `replayStats` passthrough, `ReplayDrawer` Stats tab live (possession bar + sparkline with goal dots + playhead, mirrored tirs/récups/dribbles rows, distance ranking, team-accent CSS vars per 7.4), TIR rows in Logs (click → seek)
- [x] Task 6: Graceful degradation — no stats block → ghost "à venir" states (message updated: "rejouez-le pour l'obtenir"); unit tests
- [x] Task 7: Unit tests — engine Telemetry suite (16) + Simulation integration (4), client drawer v2 + matchEvents lib; e2e seek-on-shot deferred (Epic 7 sweep, like 7.7 Task 7)

## Verification

- Engine: `npm test` 167/167 green, `npm run build` (tsc) clean — byte-identity determinism gate passes WITH stats
- Front: `npx tsc -b` clean, `npm run lint` 0 errors (4 pre-existing warnings), `npm run test:unit` 633/633 green
- Manual pending: live S1 panel on a fresh simulated match; old replay degrades to ghosts

## Dev Agent Record

### Completion notes

- Turnover law verified at three levels: tracker unit (teammate pickup ≠ turnover), kickoff restart ≠ recovery, Simulation storm (contention bounded by population + 180-tick lockouts).
- On-target definition = shot INTENTION (direct trajectory, friction, no rebounds); the goal event remains the OUTCOME's truth. Midfield full-power shots legitimately die short — pinned in tests.
- Possession sparkline = 36 bins of 5s (challenger share %), playhead syncs to currentFrame's bin; goal dots at their bins (sun = challenger, corail = opponent).
- Drawer team accents flow from match customization (7.4) via `--home-accent`/`--away-accent` CSS vars with token fallbacks.
- Not committed (same batch as 7.7 Task 3, awaiting Pelo's walkthrough).

### File List

- lachatadede-engine/src/engine/Telemetry.ts (new)
- lachatadede-engine/src/engine/types.ts (ShotEvent, TurnoverEvent, TeamStats, PlayerStats, MatchStats, SimulationFrameFile.stats)
- lachatadede-engine/src/engine/Simulation.ts (telemetry hooks at applyAction/movePlayer/checkPossession/checkGoal/kickoffTeam/stepTick/run)
- lachatadede-engine/src/engine/__tests__/Telemetry.test.ts (new, 16 tests)
- lachatadede-engine/src/engine/__tests__/Simulation.test.ts (telemetry describe: 4 integration tests; 2 legacy tests updated for shot events)
- src/types/shared.ts (MatchShotEvent, MatchTurnoverEvent, MatchTeamStats, MatchPlayerStats, MatchStats, MatchFramesFile.stats?)
- src/lib/matchEvents.ts (new — extractFrameEvents)
- src/stores/matchStore.ts (replayStats passthrough + clear)
- src/components/match/ReplayDrawer.tsx (v2: live S1 sections, shot rows, accents)
- src/pages/MatchPage.tsx (shotEvents memo, stats/shotEvents wiring)
- tests/unit/components/replay-drawer.test.tsx (live-telemetry + shot-row tests)
- tests/unit/lib/match-events.test.ts (new)

## Change Log

- 2026-09-22: Story created from party session (Pelo validated S1 mockup + rich-stats direction).
- 2026-09-22: IMPLEMENTED — engine telemetry + stats block + drawer v2 live. All suites green (engine 167/167, front 633/633).
