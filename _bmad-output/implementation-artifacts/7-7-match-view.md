---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 7.7: Match View — Broadcast Replay

Status: done

## Story

As a player,
I want a dedicated full-screen match view with scoreboard, timeline and logs,
So that watching a replay feels like a broadcast, not a debug session.

## Acceptance Criteria

1. **Given** `/match/:id`, **When** it loads, **Then** the pitch fills the stage with a floating score pill (team names in their colors, score, minute, frame counter), a "Quitter" chip, and the video-editor timeline below (play/pause, skip, speed, scrubber with sun goal ticks, frame X/Y).
2. **Given** the right drawer, **When** the player opens Logs or Stats, **Then** match events render as rounded rows with badges (BUT / TIR / MT / carton) linked to frames — the old debugger panel's data lives here, and clicking a goal tick jumps to its frame.
3. **Given** simulation and its outcome, **When** a match runs or ends, **Then** the Simulating overlay (spinner + frame count) covers the pitch, goals trigger the celebration overlay (confetti, scorer line), and the result card shows V/D with elo delta and "Revoir le match".
4. **Given** a missing or failed replay, **When** the load errors, **Then** a friendly state with retry shows instead of a blank screen.

## Scope Boundary (read first)

- Full cutover: replay rendering leaves /teams — MatchPage owns TacticsCanvas + Timeline + drawer. The workspace replay path (loadReplay inside teams) and DebuggerPanel are retired here (7.8 sweeps the leftovers).
- Score pill: challenger/opponent names in their colors (MatchSerializer 7.4 fields), score live via computeScore, minute = formatTime, frame X/Y in mono.
- Timeline: restyled Timeline (corail fill, sun goal ticks, mono info, speed control 0.5×/1×/2×/4×; ⏮/⏭ step one frame, Home/End provide skip-to-start/end — review ruling 2026-09-23) — playback keys (Space/arrows) move here from AppShell.
- Drawer tabs: Logs (existing replayLogs pipeline: badges BUT for goal events, MT for mid-frames if present, log rows with level colors; player filter chips kept) + Stats (honest aggregate: score, goals list w/ minutes + scorer slot, total frames, mode, date — no invented possession numbers).
- Goal celebration: existing canvas flash+confetti + HTML overlay line "BUUUT !" + scorer (#slot · team) + score line; live goals run a 3s broadcast countdown (score hold 1.2s + 3-2-1 + kickoff pause — review ruling 2026-09-23 supersedes the earlier "~1.5s"; reduced-motion respected).
- Simulating overlay: the veil (spinner + frame count: durationFrames when known, else estimated chip) renders on the TRIGGERING page (Play/Teams) while the POST runs — the POST completes before navigation, so /match/:id only ever shows the frames-loading overlay (review ruling 2026-09-23).
- Result card: ranked keeps the shared ResultCard (7.6) in the /play chooser after a settled challenge; practice (no elo) navigates straight to /match/:id with no result card (review ruling 2026-09-23); the match view offers "Revoir le match" via its Quittter → /play and history.
- Quitter chip → navigate(-1) if history exists else /play.

## Tasks / Subtasks

- [x] Task 1: `MatchPage` full build — stage layout (pitch flex + 300px drawer), score pill, Quittter chip, timeline bar, drawer tabs (Logs/Stats), loading/simulating/error-retry states; playback wiring (canvas handle + keyboard shortcuts moved from AppShell)
- [x] Task 2: Timeline restyle + speed control — token look, sun goal ticks (click → seek), speed cycling, frame counter mono; keep ARIA slider + drag behavior
- [x] Task 3: Drawer — built as `ReplayDrawer` (S1 "Tableau de bord" design, mockup validated by Pelo: planning-artifacts/stadium-mockup-ronde-replay-stats-s1-tableau-de-bord.html). Stats tab: VS header (tactic names, crests in team colors, live score, minute), goals list (minute + #slot + team, click → seek), meta foot (mode / frames / date), telemetry sections as GHOST states ("à venir" — story 7.9; no invented numbers). Logs tab: goal rows (click → seek) + windowed ±1s log rows (replayLogs pipeline reused as-is) with player filter chips + "Tous" reset. Shared `ReplayDrawer` extracted fresh (DebuggerPanel data logic reused via libs, its shell stays retired)
- [x] Task 4: Celebration overlay — scorer line + score chip on goal ticks (event-driven, 1.5s, reduced-motion)
- [x] Task 5: Remove workspace replay path — TeamsPage stops hosting Timeline/DebuggerPanel/replay overlays; practice watch → /match/:id
- [x] Task 6: Unit tests — MatchPage states, drawer badge mapping (BUT covered; TIR/MT/carton wait for engine events), speed control, celebration event handling; retire debugger-panel tests
- [x] Task 7: E2E `practice-match.spec.ts` traversal update — replay now on `/match/:id` (load frames event hook kept), scrubber/logs/celebration assertions on the new view (chromium)

## Verification

- `npx tsc -b`, `npm run lint`, `npm run test:unit` green
- Manual: replay plays like a broadcast; goal tick click seeks; Quittter returns; bad id → retry state

## Dev Agent Record

### Completion notes

- Drawer (Task 3) shipped ahead of the full story: `ReplayDrawer` (src/components/match/ReplayDrawer.tsx) wired into `MatchPage`'s stage row (pitch flex:1 + 300px drawer, gap 8). Design = S1 mockup validated by Pelo (2026-09-22 party session). Telemetry sections (possession/tirs/récups/dribbles/distance) render as ghost "à venir" states — their data does not exist in frames yet, story 7.9 emits it. Seek affordance: goals in both tabs call canvas seekFrame.
- New lib: `extractGoalEvents` (src/lib/score.ts) — goals with scorer slot, keyed on array position, malformed-event tolerant.
- Verification: `tsc -b` clean, `npm run lint` 0 errors (4 pre-existing warnings), full unit suite 630/630 green (10 new: replay-drawer.test.tsx ×7, score.test.ts extractGoalEvents ×3). E2E not run (Tasks 6/7 pending).

### File List

- src/components/match/ReplayDrawer.tsx (new)
- src/pages/MatchPage.tsx (drawer wiring, stage gap, goalEvents memo)
- src/lib/score.ts (extractGoalEvents)
- tests/unit/components/replay-drawer.test.tsx (new)
- tests/unit/lib/score.test.ts (extractGoalEvents cases)
- src/components/layout/Timeline.tsx (restyled broadcast timeline)
- src/components/layout/TacticsCanvas.tsx + lachatadede-engine/src/engine/Game.ts (setSpeed handle)
- src/pages/TeamsPage.tsx + src/components/layout/AppShell.tsx (replay path removed)
- src/styles/tokens.css (goal-pop keyframes + reduced-motion)
- tests/e2e/practice-match.spec.ts (rewritten to /match/:id)
- tests/unit/components/timeline.test.tsx (new), tests/unit/pages/match-page.test.tsx (new)
- tests/unit/components/debugger-panel.test.tsx (deleted)

## Change Log

- 2026-09-22: Task 3 (Drawer) implemented per validated S1 mockup; telemetry scope deferred to story 7.9.
- 2026-09-22: Tasks 1, 2, 4, 5, 6, 7 — story complete, review. MatchPage full build (score pill La Ronde, Quittter chip w/ history fallback, keyboard playback moved from AppShell, celebration overlay 1500ms, goal-driven log filter semantics 3.11, TEST_LOAD_FRAMES_EVENT hook). Timeline restyled (skip start/end, speed cycle 0.5/1/2/4 via PLAYBACK_SPEEDS + Game.setSpeed validation, sun goal ticks clickable, mono frame counter, ARIA kept). AppShell purged of replay/overlays/keyboard (edit-mode only; 7.8 deletes it). E2E practice-match.spec.ts rewritten to /match/:id — 8/8 chromium green; drawer log rows carry data-tick + type badges (MULTIPLE_ACTIONS...) for warn/error entries; unit suite 630/630 (timeline.test ×6, match-page.test ×7 new; debugger-panel.test retired); tsc -b + lint clean.
- 2026-09-22: Stats-law pass (Pelo decree): Tirs row = cadrés only; new Passes row with réussite %; Dribbles row removed; Logs shot rows show TIR/PASSE badges. (Engine side recorded in story 7.9.)

### Completion notes (task pass)

- Task 1/4: MatchPage owns score pill (score-display + pill-frame-counter), exit chip (navigate(-1) if history else /play), keyboard (Space/←/→/Shift-arrows), celebration overlay (goal-celebration-overlay, BUUUT ! + scorer + score, lachatadede-goal-pop keyframes in tokens.css, reduced-motion respected, CELEBRATION_DURATION_MS 1500). Pitch-click filter semantics per 3.11: player with logs → select+filter; chip click → filter+select; "Tous" resets filter; canvas ring mirrors store selection.
- Task 2: Timeline keeps its drag/ARIA logic; speed state local (remount per replay resets to 1×); setSpeed validated server-side in engine Game ([0.5,1,2,4] else 1).
- Task 5: AppShell no longer imports Timeline/playbackShortcuts/matchStore replay slice; replay handoff, score display, celebration, replay error banner, replay loading overlay all removed. workspace.spec.ts stays green with zero replay references.
- Task 6: match-page.test uses MemoryRouter initialIndex=1 (['/play','/match/m-1']) for history-fallback assertions; canvas fully mocked.
- Task 7 e2e lessons: register the /frames waitForResponse listener BEFORE triggering navigation (fetch starts at mount, 90s timeout); drag test picks a marker-free x (goal sun markers swallow pointerdown); the demo match scores roughly one goal per 10s of wall time.
- TEST_LOAD_FRAMES_EVENT test hook lives in MatchPage (seeds useMatchStore + setMatchFrames + loadFrames); the old hook in AppShell was removed with the rest of the replay path.

### Review Findings

- [x] [Review][Decision] Simulating overlay never renders on /match/:id — POST completes before navigation (await startPracticeMatch → navigate), so `isSimulating` is always false on arrival; the veil + frame count live on Play/Teams instead. Spec scope says the overlay renders on /match/:id. Ruling: move/duplicate the veil onto the match view, or amend the scope note to accept triggering-page coverage? **RESOLVED 2026-09-23: amend spec — triggering-page veil accepted (scope note updated).**
- [x] [Review][Decision] Practice result card never rendered — AC3 scope note says the shared ResultCard is "also rendered by Teams page for practice", but Teams/Play navigate straight to /match/:id (code comment: "Success navigates to the /match/:id viewer, so no result state lives here"). Ranked keeps its card in the /play chooser. Ruling: accept navigation-only practice flow (amend spec), or restore a practice result card? **RESOLVED 2026-09-23: amend spec — navigation-only practice flow accepted (scope note updated).**
- [x] [Review][Decision] Live-goal celebration runs a 3s countdown + kickoff pause (`CELEBRATION_TOTAL_MS = 3000`) vs spec "~1.5s, reduced-motion respected" — deliberate feature (3-2-1 countdown, score hold 1200ms), pinned by its own tests. Ruling: accept 3s and amend spec, or restore ~1.5s? **RESOLVED 2026-09-23: amend spec — 3s broadcast countdown accepted (scope note updated).**
- [x] [Review][Decision] ⏮/⏭ buttons step one frame, not "skip-to-start/end" per scope (Home/End on the slider is the only real skip; Timeline header comment documents the choice). Ruling: accept step buttons and amend spec, or implement true skip? **RESOLVED 2026-09-23: amend spec — step buttons accepted, Home/End is the true skip (scope note updated).**
- [x] [Review][Patch] Cross-match replay race — navigating /match/A → /match/B while A's fetch is in flight swallows B's load (`if (isReplayLoading) return`), installs A's frames under B's URL, never retries [src/stores/matchStore.ts:184, src/pages/MatchPage.tsx:101]
- [x] [Review][Patch] Drawer seek skips `cancelCelebration()` — clicking a goal row during the live-goal countdown leaves the overlay up and auto-resumes playback ~3s later, breaking the "user takes over mid-countdown" contract [src/pages/MatchPage.tsx:437]
- [x] [Review][Patch] 2x/4x playback skips intermediate frames (`currentFrame += speed * ticks`, one `applyFrame(floor)` per tick) — goals on crossed frames never fire `onGoalScored`, so celebrations/score pulses are silently missed [src/components/canvas/engine/Game.ts:213]
- [x] [Review][Patch] Own goal credited to the conceding player — `scorerSlot: this.ball.lastTouch?.slot ?? -1` uses lastTouch regardless of team; a defender's own goal renders his number as the opposing team's scorer [lachatadede-engine/src/engine/Simulation.ts:378]
- [x] [Review][Patch] Shot taken from exactly on the goal line (`prevX === FIELD_WIDTH`) fails the `prevX < FIELD_WIDTH` crossing test and counts as a pass in per-player telemetry [lachatadede-engine/src/engine/Telemetry.ts:183]
- [x] [Review][Defer] DemoBots "passing game" engine test failing at HEAD [lachatadede-engine/src/engine/__tests__/DemoBots.test.ts:192] — deferred, pre-existing (verified failing with the review patches stashed; regression from non-story commit a0ddccc "Rebalance player and ball speeds (v1.7)")
