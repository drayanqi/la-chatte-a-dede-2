---
baseline_commit: a0ddccc
---

# Story 7.10: Pre-Match Ceremony

Status: review
Decided by Pelo (party session 2026-09-24): ceremony after generation only, entry from the sidelines, 3-2-1 countdown
Depends on: 7.7 (broadcast viewer), 7.4 (team colors)

## Story

As a player,
I want a freshly generated match to open with both teams walking onto the pitch in their colors and taking their tactic spots under a VS card, followed by a 3-2-1 kickoff countdown,
So that the match feels like it is being staged in front of me instead of appearing fully formed.

## Background (locked in party session 2026-09-24)

- Pelo's ask: "une scène générée quasi instantanément où les deux équipes avec leurs couleurs rentrent sur le terrain et se placent selon la tactique — noms au centre, puis compte à rebours comme entre chaque but (sans le 0-0)".
- The destination data already exists: frame 0 IS the kickoff placement per tactic (Simulation.test: "records frame 0 with all players at initial positions"). The ceremony is a presentation-only tween — zero sim/engine changes, frames byte-identical.
- Pelo's three locks (question round): trigger = fresh generation ONLY (`?fresh=1`, consumed + stripped — refresh/history/deep-link never replay it); entry = from each team's own sideline; countdown = 3-2-1 (3s), same cadence as the goal countdown, no score card.

## Acceptance Criteria

1. **Given** a fresh generation (practice from Play/Teams, ranked result "Revoir le match" — all navigate with `?fresh=1`), **When** the viewer loads its frames, **Then** the 10 sprites spawn beyond their sideline (home left, away right, at their target y) and walk to their frame-0 positions (staggered ~100ms/slot, ~1.4s, ease-out cubic) with the ball hidden.
2. **Given** the walk running, **When** observed, **Then** the VS card (team names in their colors, "VS" center) sits over the pitch and the score pill is absent — no 0-0 anywhere; the timeline stays visible.
3. **Given** the walk finished, **When** `onIntroComplete` fires, **Then** the page freezes the kickoff frame (`setKickoffPause` — pulsing ring at the keeper's ball) for the 3-2-1 countdown, then starts playback.
4. **Given** any takeover (overlay click, Space, seek, step, pause, play), **When** it happens during the ceremony, **Then** the ceremony is skipped: timers cleared, kickoff pause lifted, the engine cancels its walk (snap to frame 0) and playback proceeds per the action.
5. **Given** a non-fresh load (history/palmarès rows, deep link, reload — the `?fresh=1` flag is consumed on mount and stripped with `replace`), **When** the viewer loads, **Then** no ceremony plays.
6. **Given** prefers-reduced-motion, **When** the ceremony runs, **Then** the walk is skipped (teams stand at their spots for a ~1s hold) while the VS card and countdown still play.
7. **Given** the engine, **When** the ceremony runs, **Then** the tween allocates nothing per frame (goal-celebration pattern: pre-built entries, delta-driven positions) and the frames payload is never mutated (determinism law).
8. **Given** the test hook `TEST_LOAD_FRAMES_EVENT`, **When** frames are injected, **Then** no ceremony plays (fast e2e path preserved).

## Scope Boundary

- No new data: the kickoff spots come from frame 0; no API/engine-contract change; no tactic/geometry edits.
- The drawer stays mounted during the ceremony (broadcast furniture); only the center-screen scoreline (pill) is hidden.
- No celebration-during-walk interaction guarantee: a goal can only fire during playback, which cannot start before the ceremony ends.

## Tasks / Subtasks

- [x] Task 1: Engine intro phase — `Game.loadFrames(frames, { intro })` (queued-load carries the flag), `startIntro` (off-pitch spawn per side via `teamIdFromMatchTeam`, staggered delays), `updateIntro` (delta-tween in `gameLoop`, ease-out cubic, reduced-motion hold), `completeIntro` (snap `applyFrame(0)`, ball visible, `onIntroComplete`), `cancelIntro(snap)` wired into `play`/`pause`/`step`/`seekFrame`, intro state reset in `destroyAllPlayerSprites`/`destroy`
- [x] Task 2: Engine callbacks — `onIntroStart` (fired when the walk actually begins, including a queued load) + `onIntroComplete`; census republished on complete (ball visibility echo)
- [x] Task 3: TacticsCanvas — `loadFrames(frames, opts?)` + `onIntroStart`/`onIntroComplete` props
- [x] Task 4: MatchPage ceremony machine — `?fresh=1` consume + strip effect (declared before the frames-load effect), `introPhase` walk→countdown→null driven by engine events (`handleIntroStart`/`handleIntroComplete`), VS card + solo countdown overlays, pill gated on `introPhase === null`, `cancelOverlays` folds the ceremony teardown into the celebration cancel contract, Space/arrows skip to kickoff, `!isPlaying` rogue-load escape hatch
- [x] Task 5: Fresh-generation flows — PlayPage practice + ranked result watch, TeamsPage start/retry practice: `navigate(...?fresh=1)`
- [x] Task 6: E2E — practice spec ceremony case (VS card without pill → countdown → skip click → playback → reload without ceremony)
- [x] Task 7: Tracking — epics.md story, sprint-status key, this file

## Verification

- `npx tsc -b --force` clean; `npm run lint` 0 errors (3 pre-existing warnings, constructs untouched by the diff)
- Front unit `npx vitest run` 606/606 green; engine `npx vitest run` 182/183 — the 1 red is the pre-existing DemoBots "passing game" (seed 42 handoffs, documented 2026-09-24, engine/src untouched this session)
- E2E chromium pending Pelo's walkthrough (practice ceremony + full practice + ranked shards)

## Dev Agent Record

### Completion notes

- The walk phase is armed by the engine's `onIntroStart` (not by the frames effect): a queued load behind canvas init raises the overlay exactly when the walk begins, and the page keeps zero synchronous setState in effects (react-hooks/set-state-in-effect).
- Rogue duplicate frames-load without the flag (store re-emit): the engine autoplays and the `!isPlaying` guard drops the VS card instead of leaving it hanging over a live match.
- The countdown reuses the goal celebration's interval cadence (3s, 100ms poll) and its `countdownSolo` visuals; kickoff pause gives the pulsing ring for free.
- Sideline spawn = −6% / +106% pitch x at the target y (horizontal walk-in), stagger 6 ticks per slot, walk 84 ticks.
- Sprint-status key: 7-10-pre-match-ceremony.

### File List

- src/components/canvas/engine/Game.ts (intro phase: startIntro/updateIntro/completeIntro/cancelIntro, loadFrames opts, callbacks)
- src/components/canvas/TacticsCanvas.tsx (loadFrames opts + onIntroStart/onIntroComplete props, census on complete)
- src/pages/MatchPage.tsx (ceremony machine, VS card, pill gating, skip, fresh-flag consume/strip)
- src/pages/PlayPage.tsx (?fresh=1 on practice + ranked result watch)
- src/pages/TeamsPage.tsx (?fresh=1 on practice start/retry)
- tests/e2e/practice-match.spec.ts (ceremony case)
- _bmad-output/planning-artifacts/epics.md (story 7.10)
- _bmad-output/implementation-artifacts/sprint-status.yaml (key)

## Change Log

- 2026-09-24: Story decided + implemented in one party session (Pelo's question round: trigger/entry/countdown locks). All suites green except the documented pre-existing DemoBots red.
