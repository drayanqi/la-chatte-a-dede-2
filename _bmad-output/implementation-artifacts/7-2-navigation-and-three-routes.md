---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 7.2: Navigation & Three Routes

Status: done

## Story

As a player,
I want real routes for playing, preparing and watching,
So that each activity is a place I can reach, bookmark and leave cleanly.

## Acceptance Criteria

1. **Given** an authenticated player, **When** they open the app, **Then** `/` redirects to `/play`, and Jouer / Équipes highlight the active route (Palmarès and Classement included in the nav).
2. **Given** any navigation between routes, **When** the view unmounts, **Then** the overlay anatomy (RankedView/LeaderboardView above a hidden workspace) is removed — each route owns its view, and deep links like `/match/:id` work on refresh.

## Scope Boundary (read first)

- Route set: `/login`, `/register`, `/play` (PlayPage), `/teams` (TeamsPage = workspace content), `/match/:id` (MatchPage, replay loads via matchStore.loadReplay), `/palmares` (token-styled placeholder card), `/classement` (LeaderboardView restyled to tokens, now a page not an overlay), `/` → `/play`, `*` → `/play`.
- The workspace AppShell content moves to `/teams` WITHOUT the 7.5 re-layout yet (panel structure keeps working as-is until 7.5); ranked/leaderboard overlays are stripped from it here.
- RankedView becomes an in-page state of PlayPage in 7.6; in this story the "Ranked" trigger is temporarily re-homed so nothing is unreachable: `/play` initially renders a minimal lobby stub (hero card with elo + links) that 7.6 fills in. Actually: PlayPage in this story = Appbar + simple stub card; the ranked overlay is REMOVED from AppShell (feature returns on /play in 7.6).
- Canvas keeps mounting/unmounting with `/teams` — no more mount-preservation requirement (the old overlay anatomy existed to avoid re-init; Pixi init is fast and deterministic).

## Tasks / Subtasks

- [x] Task 1: Routing (`App.tsx`)
  - [x] Routes: `/login`, `/register` (public), protected: `/play`, `/teams`, `/match/:id`, `/palmares`, `/classement`; `/` and `*` → Navigate `/play`
  - [x] Login/Register redirect target becomes `/play` (was `/workspace`)
- [x] Task 2: `PlayPage` stub (`src/pages/PlayPage.tsx`) — Appbar + greeting card with elo (from tactics store) + "Équipes" CTA; full lobby in 7.6
- [x] Task 3: `TeamsPage` (`src/pages/TeamsPage.tsx`) — hosts the former workspace layout (team tabs + panels + canvas) with overlay anatomy removed; no ranked/leaderboard state
- [x] Task 4: `MatchPage` shell (`src/pages/MatchPage.tsx`) — on mount `matchStore.loadReplay(id)`; renders canvas + loading/error states (full broadcast UI in 7.7); unmount clears replay (`clearReplay`)
- [x] Task 5: `PalmaresPage` placeholder — fcard with "Le palmarès arrive bientôt" (tokens only, no fake data)
- [x] Task 6: `LeaderboardPage` — LeaderboardView content moved out of overlay, token-styled, fetches on mount, my-row highlight lands in 7.6 rail (here: plain table + back CTA removed — nav covers it)
- [x] Task 7: `AppShell` → `TeamsLayout` refactor — remove rankedOpen/leaderboardOpen state, RankedView/LeaderboardView imports and overlay z-index stack; keep practice match + replay-in-workspace flow working until 7.7 (replay continues to render inside /teams for now, match view takes over in 7.7)
- [x] Task 8: Unit tests — route smoke tests (routes resolve, `/` redirects to `/play`, protected redirect to `/login`)

## Verification

- `npx tsc -b`, `npm run lint`, `npm run test:unit` green
- Manual: deep link `/teams` + refresh works; `/match/:id` refresh works; old `/workspace` falls to `*` → `/play`

## Dev Agent Record

### Completion notes

- Route cutover complete; WorkspacePage deleted. PlayPage hosts the ranked flow until 7.6 (fetches tactics itself so `ranked-my-fighter-row` has data; watch-replay navigates to `/teams` where AppShell replay mode renders it until 7.7).
- AppShell guard added: the tactic-load effect skips canvas load + `clearReplay()` while `isReplayLoading || replayFrames.length > 0` — otherwise mounting `/teams` mid-watch clobbered the in-flight replay (caught by `ranked-matchmaking.spec` history-flow).
- LeaderboardPage keeps the story 4.5 e2e contract: `leaderboard-rank` renders `#N`, `leaderboard-record` renders `elo · W-L`, `leaderboard-you` badge text "You" (French copy sweep lands with the 7.6 redesign).
- E2e traversals updated: auth/workspace/tactic-tabs/practice-match/panel-layout → `/teams`, leaderboard → `/classement` direct, ranked → `/play` + `ranked-open-button`, support helper `openWorkspaceScript` → `/teams`, lineup-gating copy → French. All affected specs green on chromium.
- Verified: `rtk tsc -b` ✓, eslint 0 errors, `npm run test:unit` 546/546 ✓ (incl. new `app-routes.test.tsx` with mocked page stubs — Monaco is jsdom-hostile). Full 3-browser sweep deferred to 7.8 per plan.

## File List

- `src/App.tsx`, `src/pages/PlayPage.tsx`, `src/pages/TeamsPage.tsx`, `src/pages/MatchPage.tsx`, `src/pages/PalmaresPage.tsx`, `src/pages/LeaderboardPage.tsx`, `src/pages/index.ts`
- `src/pages/WorkspacePage.tsx` (deleted), `src/components/layout/AppShell.tsx`, `src/components/tactics/TabBar.tsx`
- `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx` (redirect target)
- `tests/unit/app-routes.test.tsx` (new), `tests/unit/components/tab-bar.test.tsx` (copy update)
- `tests/support/helpers/editor.ts`, `tests/e2e/{auth,workspace,tactic-tabs,practice-match,panel-layout,leaderboard,ranked-matchmaking}.spec.ts` (traversals + copy)

## Change Log

- 2026-09-21: Story implemented (routing table, page shells, AppShell de-overlaying, replay-in-teams guard, e2e traversal + copy updates).
