---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 7.7: Match View — Broadcast Replay

Status: ready-for-dev

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
- Timeline: restyled Timeline (corail fill, sun goal ticks, mono info, speed control 0.5×/1×/2×/4×, skip-to-start/end) — playback keys (Space/arrows) move here from AppShell.
- Drawer tabs: Logs (existing replayLogs pipeline: badges BUT for goal events, MT for mid-frames if present, log rows with level colors; player filter chips kept) + Stats (honest aggregate: score, goals list w/ minutes + scorer slot, total frames, mode, date — no invented possession numbers).
- Goal celebration: existing canvas flash+confetti + HTML overlay line "BUUUT !" + scorer (#slot · team) + score line, ~1.5s, reduced-motion respected.
- Simulating overlay: rendered on /match/:id when arriving from a just-started practice/ranked match (matchStore.isSimulating during POST + frames loading spinner after navigation); "frame count" = durationFrames when known, else estimated chip.
- Result card: after a ranked/practice match completes (from Play or Teams trigger), the triggering page shows the V/D card; the match view itself offers "Revoir le match" via its Quittter → /play and history. AC3's result card = the shared ResultCard component from 7.6, also rendered by Teams page for practice.
- Quitter chip → navigate(-1) if history exists else /play.

## Tasks / Subtasks

- [ ] Task 1: `MatchPage` full build — stage layout (pitch flex + 300px drawer), score pill, Quittter chip, timeline bar, drawer tabs (Logs/Stats), loading/simulating/error-retry states; playback wiring (canvas handle + keyboard shortcuts moved from AppShell)
- [ ] Task 2: Timeline restyle + speed control — token look, sun goal ticks (click → seek), speed cycling, frame counter mono; keep ARIA slider + drag behavior
- [ ] Task 3: Drawer — Logs list (badges BUT/TIR/MT/carton mapping from events/logs, frame link → seek), Stats tab aggregates; extract shared `ReplayDrawer` from DebuggerPanel data logic (replayLogs lib reused as-is)
- [ ] Task 4: Celebration overlay — scorer line + score chip on goal ticks (event-driven, 1.5s, reduced-motion)
- [ ] Task 5: Remove workspace replay path — TeamsPage stops hosting Timeline/DebuggerPanel/replay overlays; practice watch → /match/:id
- [ ] Task 6: Unit tests — MatchPage states, drawer badge mapping, speed control, celebration event handling; retire debugger-panel tests
- [ ] Task 7: E2E `practice-match.spec.ts` traversal update — replay now on `/match/:id` (load frames event hook kept), scrubber/logs/celebration assertions on the new view (chromium)

## Verification

- `npx tsc -b`, `npm run lint`, `npm run test:unit` green
- Manual: replay plays like a broadcast; goal tick click seeks; Quittter returns; bad id → retry state

## Dev Agent Record

### Completion notes

(pending)

## File List

(pending)

## Change Log

(pending)
