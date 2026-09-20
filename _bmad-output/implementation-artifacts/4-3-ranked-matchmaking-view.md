---
baseline_commit: a3d02b04faed3634cadaee5a4077d8180090adb2
---

# Story 4.3: Ranked Matchmaking View

Status: done

## Story

As a user,
I want a dedicated ranked screen,
So that I can manage my fighters and find opponents.

## Acceptance Criteria

1. **Given** I open the ranked view, **When** my ready tactics are listed, **Then** each shows its elo and record with a Quick Match button.

2. **Given** other players' ready tactics exist, **When** I browse the opponents list, **Then** each row shows owner, tactic name, elo and record with a Challenge button.

3. **Given** I just played a ranked match, **When** the simulation completes, **Then** I see the score and my elo change, **And** I can watch the replay.

4. **Given** no ready tactics from other players exist, **When** I browse the opponents list, **Then** I see an empty state inviting me back later.

## Scope Boundary (read first)

- **Full-screen view swap INSIDE AppShell** (a `rankedOpen` overlay/state, NOT a route): the PixiJS engine, panels and tabs stay mounted underneath — no remount churn, no re-init races (decision: Winston/Pelo). Workspace keyboard shortcuts (Space/arrows) are suppressed while the overlay is open.
- **Watching a replay from the ranked view** closes the overlay first, then reuses the existing practice `loadReplay` path.
- The opponents list has no pagination in v1 (small user base). The challenge fighter for the list is picked with a "Fighting as" selector over my ready tactics.
- No notifications for the offline opponent in v1 — they see the match in their history (list exists via `GET /matches`).

## Tasks / Subtasks

### Frontend Tasks (React — `src/`)

- [x] Task 1: Types + store
  - [x] `types/shared.ts`: `RankedOpponent { id, name, owner, elo, wins, losses }`; `MatchResult` gains optional `pointsChallenger`/`pointsOpponent`/`challengerName`/`opponentName`
  - [x] New `src/stores/rankedStore.ts` (`useRankedStore`): `opponents`, `isLoadingOpponents`, `opponentsError`, fetch/refresh; play flow — `activeTacticId`, `opponentTacticId`, `match`, `isPlaying`, `matchError`; `quickMatch(tacticId)`, `challenge(tacticId, opponentTacticId)`, `clearResult`, `reset` (logout wiring in `authStore`); 401 → dead-session logout (matchmakingStore precedent); export from `stores/index.ts`
- [x] Task 2: `Header` — "Ranked" navigation button (replaces the removed queue button wiring), always enabled, opens the view
- [x] Task 3: `RankedView` (`src/components/ranked/RankedView.tsx`)
  - [x] Full-screen overlay (opaque, above workspace, below dialogs), back button returns to the workspace
  - [x] My fighters column: my ready tactics (name, elo, W-L) each with Quick Match; empty state pointing at the tab ready toggles
  - [x] Opponents column: "Fighting as" selector (my ready tactics), rows (owner, tactic name, elo, record, Challenge), loading / error / empty ("No opponents ready yet") states
  - [x] Result banner after a match: score, outcome, elo delta (from `pointsChallenger`), Watch replay + Close; failure banner for 502/404/422 with retry-friendly message
  - [x] After a settled match: refresh opponents + tactics store (elo/records moved)
- [x] Task 4: `AppShell` wiring
  - [x] `rankedOpen` state; overlay rendered when open; workspace keyboard shortcuts guarded while open
  - [x] `handleRankedWatchReplay`: close overlay + `loadReplay(match)` (canvas stays alive underneath)
- [x] Task 5: Unit tests
  - [x] `ranked-store.test.ts`: fetch opponents mapping/errors, quickMatch/challenge happy + failure paths, 401 logout, clearResult/reset
  - [x] TabBar ready-toggle unit tests (from story 4.1 still green)

### E2E (Playwright — `tests/e2e/ranked-matchmaking.spec.ts`)

- [x] Task 6: E2E (replaces the deleted `ranked-queue.spec.ts`; engine-backed like `practice-match.spec.ts`)
  - [x] Seed two users via API (tactics + scripts complete, both marked ready)
  - [x] As B: open ranked view → opponents list shows A's tactic → Challenge → result banner with score + elo delta → replay watch returns to workspace
  - [x] As B: Quick Match from my fighters → match plays
  - [x] As A (API): elo/wins/losses moved, match visible in `GET /matches`

## Verification

- `npm run lint`, `npx tsc -b`, `npm run test:unit` green
- `npm run test:e2e -- --workers=1` green (workspace + auth + practice suites unaffected)
- Manual smoke: ready toggle → ranked view → quick match → result → replay → history as the offline opponent

## Dev Agent Record

**Completed 2026-09-19.** All acceptance criteria verified.

### Approach notes

- `rankedStore` guards against double-play with a monotonically increasing `playSeq` token: a stale in-flight play response (e.g. user closed/reopened mid-simulation) never lands as a result. 401 during any ranked call → dynamic-import `authStore` and logout (dead-session precedent from the old matchmaking store); dynamic import avoids a static store cycle, while `authStore.reset()` clears ranked state via a static import the other way.
- `RankedView` is an opaque overlay (`zIndex` above workspace, below dialogs) rendered from `AppShell` when `rankedOpen`; the workspace keyboard handler early-returns while it is open (Space/arrows can't scroll or trigger the engine underneath). "Fighting as" selector defaults to the first ready tactic; Challenge is disabled while a play is in flight.
- After a settled match the store refreshes BOTH `rankedStore.fetchOpponents()` and `tacticsStore.fetchTactics()` (dynamic import) so elo/W-L across the UI are consistent without a reload.
- `handleRankedWatchReplay` closes the overlay first, then calls the existing practice `loadReplay(match.id, match)` — the PixiJS canvas stays mounted underneath, per the scope boundary.

### Completion notes / deviations

- Result banner shows the score and the challenger-side elo delta (`pointsChallenger`, signed, e.g. "+25"); the loser's mirrored delta is in the match row (visible in history once story 4.4 lands).
- E2E needed two fixes over the first draft: the engine canvas is selected via `data-testid="field-canvas"` (not a `<canvas>` selector) and the spec uses the shared `apiContext` fixture (was referencing an undefined fixture → collection error). Fixed before first green run.
- Full-suite e2e sweep is deliberately deferred to end-of-epic per Pelo (only the new `ranked-matchmaking.spec.ts` ran so far).

### Verification results

- `rtk tsc -b` clean; `eslint src tests` 0 errors (4 pre-existing warnings); unit suite green (481 at story completion; **501** after epic close-out added the queued ready-toggle merge test).
- `tests/unit/stores/ranked-store.test.ts`: **15 tests green** (opponents mapping + error, quick/challenge happy + failure, 401 logout, playSeq staleness, clearResult/reset). TabBar ready tests: 18 green in file.
- E2E `tests/e2e/ranked-matchmaking.spec.ts` (chromium): **3/3 green** against the real engine — two-user seed via API, challenge with result banner (score + elo delta) + replay-to-workspace, quick match, and API-side assertion that A's tactic elo/wins/losses moved and the match appears in `GET /matches`.
- Remaining e2e suites (workspace/tactic-tabs/practice/auth/editor) intentionally **not** re-run yet — deferred to the end-of-epic full sweep.

### End-of-epic full sweep (run 2026-09-20, per Pelo's "suite only at epic end")

- Full sweep (`playwright test`, chromium+firefox+webkit, workers:1): **252 passed, 19 failed, 2 did-not-run** — chromium 100% green including every ranked/tactic-tabs/practice test; the 19 failures all sat in firefox/webkit with 11–32 min per-test durations (the Mac slept mid-run; `caffeinate` fixed it).
- Retry of the 19 under `caffeinate --last-failed`: **12 passed immediately** (sleep flake). The remaining 7 (workspace 2.3 `Meta+s` persist on firefox+webkit, workspace 2.5 double-squiggle strict-mode on firefox) were then reproduced **identically at baseline commit `a3d02b0`** in a throwaway worktree — pre-existing, unrelated to this epic, filed for later (candidates: `Meta` vs `Ctrl` handling on non-chromium, Monaco marker duplication on firefox).
