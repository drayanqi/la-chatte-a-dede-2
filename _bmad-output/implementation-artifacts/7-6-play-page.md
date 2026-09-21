---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 7.6: Play Page — Lobby, Adversaires, Historique & Rail Classement

Status: review

## Story

As a player,
I want the app to open on a lobby with the ranked CTA, opponents, my history and the leaderboard rail,
So that playing is one obvious click away and I never lose the pulse of the ladder.

## Acceptance Criteria

1. **Given** the Play page, **When** it renders, **Then** the hero card shows greeting + elo + rank with "Match classé", "Test vs Bot" and "Revoir le dernier match"; opponents cards show crest + tactics count + elo with "Affronter"; history rows show V/D badges with score and elo delta; the right rail shows the top leaderboard with the player's own row highlighted.
2. **Given** no team is ready, **When** the player lands on Play, **Then** an explanatory state replaces the dead UI and a one-click CTA takes them to Équipes.
3. **Given** a settled match, **When** the result arrives, **Then** it lands in the history immediately and offers "watch replay" → `/match/:id`.

## Scope Boundary (read first)

- "Mon équipe" = the user's best ready tactic (highest elo); rank = its position in the leaderboard (fetch once, find row). If the user has ready tactics but none ranked, show elo without rank.
- "Match classé" opens the ranked chooser (mockup `s-ranked`): my ready tactics select + opponents list with "Affronter" → `challenge(tacticId, opponentTacticId)` → result card (V/D, elo delta) with "Revoir le match" → `/match/:id`. Quick Match from the chooser when no specific opponent chosen is NOT in the design — challenge only.
- "Test vs Bot" (sun button): practice against bot with best ready tactic → simulating state → `/match/:id`.
- "Revoir le dernier match": matchStore.fetchLatestMatch → `/match/:id` (disabled/hidden if none).
- History: rankedStore.fetchHistory (existing endpoint, V/D badge from matchPerspective, elo delta pill mint/corail).
- Rail: top 5 leaderboard rows + my row (sun highlight) + "Voir tout le classement" → `/classement`.
- No-ready-team state: fcard explaining the concept + CTA "Préparer une équipe" → `/teams`.

## Tasks / Subtasks

- [x] Task 1: `PlayPage` build-out (`src/pages/PlayPage.tsx`) — hero card (greeting, elo + rank, 3 buttons), no-ready state, ranked chooser state (team select + opponents list restyled to tokens), result card after a settled match
- [x] Task 2: Data plumbing — tacticsStore (best ready tactic), rankedStore (opponents w/ crest + ownerTacticsCount, history, leaderboard), matchStore (latest match, practice start); fetch-on-mount with per-section loading/error states
- [x] Task 3: History + rail components — `HistoryList` (V/D badge, score mono, elo delta pill, watch replay → /match/:id), `LeaderboardRail` (top rows, my-row highlight, voir-tout CTA)
- [x] Task 4: `/classement` page completion — full leaderboard table (rank, crest, team, owner, elo, V/D), my-row highlight
- [x] Task 5: Unit tests — PlayPage states (no-ready, chooser, result), history mapping (V/D/elo delta), rail highlight logic; rankedStore ownerTacticsCount mapping
- [x] Task 6: E2E `ranked-matchmaking.spec.ts` traversal update → challenge from `/play` → result card → `/match/:id` (chromium)

## Verification

- `npx tsc -b`, `npm run lint`, `npm run test:unit` green
- Manual: lobby renders with real data; no-ready state CTA works; ranked flow lands on match view

## Dev Agent Record

### Completion notes

- **PlayPage (Tasks 1-2)**: full lobby per mockup s-jouer — hero card (greeting "Salut {user}", sub « {best ready tactic} » est prête. Elo {elo} · {rank}e du classement via the tactic's leaderboard row; "Xe" suffix omitted when unranked), CTAs Match classé (corail) / Test vs Bot (sun) / Revoir le dernier match (ghost, only when `latestMatch` exists). "Mon équipe" = highest-elo ready non-system tactic. Fetch-on-mount (tactics, history, leaderboard, latest match) with per-section loading/error/retry states; a settled challenge refetches the history immediately (AC #3) and `clearResult` runs on unmount so a stale result card never haunts the chooser.
- **No-ready state (AC #2)**: the hero's dead CTAs are replaced by an explanatory card ("Aucune équipe prête" + concept) + `go-to-teams-button` → /teams; "Revoir le dernier match" survives (watching needs no ready team). Opponent cards hide their "Affronter" buttons without a ready fighter.
- **RankedChooser (scope note)**: rebuilt token-styled (mockup s-ranked) as a page state of /play — header card with `ranked-fighter-select` (ready tactics "Name · elo elo", best first), opponents rows (crest ⚽ fallback, "{owner} · {count} tactiques", mono elo, "Affronter" → `challenge(fightingAs.id, opponentId)`), simulating banner (mint spinner), error banner + Fermer, result via the shared ResultCard, "Retour" back to the lobby. Challenge only — the quickMatch store action stays but has no UI (7.8 store cleanup). The overlay `RankedView.tsx` is orphaned (renders nowhere) until its 7.8 dead-code deletion; its unit tests stay green in the meantime.
- **ResultCard (shared, 7.7 reuse per 7.7's scope note)**: challenger-perspective V/D/N disc (mint/corail/muted) + title Victoire/Défaite/Match nul, mono score, signed elo pill (mint + / corail −, hidden when points are null/0 — practice), "Revoir le match" (→ /match/:id) + "Retour au stade" (onClose).
- **HistoryList**: rows from MY side via `matchPerspective` — V/D/N badge (mint/corail/muted), "vs {opponentLabel}", delta pill, mono "{myScore} – {theirScore}", "Revoir" → /match/:id. Completed-only (failed rows unwatchable, 4.4 law). Empty/loading/error+retry states.
- **LeaderboardRail**: top 5 + my row appended (sun highlight, `rail-my-row`) when it sits deeper; my row = the fielded tactic's entry, else my best-ranked entry; "Voir tout le classement" → /classement. Ranks render as-received (server law, never re-sorted).
- **LeaderboardPage (Task 4)**: crest cell added (emoji or a colorPrimary dot fallback) inside the Équipe column; existing testids untouched.
- **Practice from the lobby**: Test vs Bot fields the best ready tactic → fixed simulating veil (sun spinner + "Simulation en cours…" + "≈ 10 800 frames · environ quelques secondes") → `navigate(/match/:id)` on success; failure renders a retryable banner (MatchStatusOverlay parity: retry, no dismiss).
- **Pelo feedback fixes (landed mid-story)**:
  - *10 players same color*: every tactic defaults to `#ff6b1a` and the swatch palette is shared → both sides could collide. New `resolveAwayTeamHex` (teamColors.ts, RGB distance ≥ `AWAY_COLLISION_DISTANCE` 100) — the away side keeps its color unless it collides with home, then the away-blue default, then the orange default. Applied at MatchPage's team-color handoff (edit mode keeps raw colors — it is the user's own pitch).
  - *Replay controls "disappeared"*: all watch paths now land on `/match/:id`, which (until 7.7) had none. The existing token-styled `Timeline` is wired into MatchPage as an interim (play/pause/step/seek + sun goal ticks); 7.7 replaces it with the broadcast build.
- **ranked-matchmaking.spec.ts (Task 6)**: rewritten for the /play traversal — challenge (hero → chooser → Affronter → result card → /match/:id + offline-A record assertions), empty pool, history loser (D badge, delta, "Revoir" → viewer), practice Test vs Bot → simulating veil → /match/:id, no-ready lobby → /teams. The old quick-match e2e is dropped with the feature (challenge only). Factory auto-cleanup deletes each test's users, so the shared pool is empty at the start of every test. **Spec not yet executed** — full 3-browser run stays deferred to the 7.8 sweep (user decision since 7.4).
- **Backend (Task 5)**: new feature test `test_opponents_expose_the_team_identity_and_owner_census_7_6` (crest/colorPrimary/ownerTacticsCount/owner shape); store-level pass-through test added (the mapping lives server-side). Matchmaking suite: 17 passed (139 assertions).
- **Gates at completion**: `tsc -b` ✓, eslint 0 errors / 4 pre-existing warnings ✓, unit **616/616 in 37 files** ✓ (588 → 616: +play-page 15, +result-card 6, +team-colors 6, +ranked-store 1; app-routes stub still passes — the hero keeps `ranked-open-button`).

## File List

- src/pages/PlayPage.tsx (rebuilt: lobby, no-ready state, chooser state, practice veil/error)
- src/pages/LeaderboardPage.tsx (crest cell)
- src/components/play/ResultCard.tsx (new, shared with 7.7)
- src/components/play/RankedChooser.tsx (new)
- src/components/play/HistoryList.tsx (new)
- src/components/play/LeaderboardRail.tsx (new)
- src/components/play/index.ts (new barrel)
- src/pages/MatchPage.tsx (interim Timeline wiring + resolveAwayTeamHex colors)
- src/lib/teamColors.ts (AWAY_COLLISION_DISTANCE, teamHexDistance, resolveAwayTeamHex)
- src/components/ranked/RankedView.tsx (orphaned; deletion stays in 7.8)
- lachatadede-api/tests/Feature/Matchmaking/RankedMatchmakingTest.php (+census feature test)
- tests/unit/components/play-page.test.tsx (new, 15 tests)
- tests/unit/components/result-card.test.tsx (new, 6 tests)
- tests/unit/lib/team-colors.test.ts (+resolver tests, 16 total)
- tests/unit/stores/ranked-store.test.ts (+census pass-through)
- tests/e2e/ranked-matchmaking.spec.ts (rewritten, 5 tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (7-6 → review)

## Change Log

- 2026-09-21: Story 7.6 implemented — /play lobby (hero + opponents + history + rail), no-ready state with Équipes CTA, token-styled ranked chooser (challenge only) with the shared ResultCard, /classement crests, practice handoff to /match/:id, away-color collision resolver, interim replay controls on the match view, e2e traversal rewrite (execution deferred to the 7.8 sweep), unit suite 616/616. Status → review.
- 2026-09-21: Post-review fix — players vanished on /teams after navigating away and back. Root cause: StrictMode double-mount (and route remount) destroys the canvas engine while the AppShell `loadedTacticIdRef` dedupe guard blocks reloading the unchanged active tactic into the fresh engine. Fix: mount effect in AppShell resets `loadedTacticIdRef` before the load effect, so every fresh engine instance reloads the active tactic. Regression e2e added to teams-page.spec.ts (nav away → back → census 5 players → GK picker opens).
