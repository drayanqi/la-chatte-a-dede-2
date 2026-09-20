---
baseline_commit: a3d02b04faed3634cadaee5a4077d8180090adb2
---

# Story 4.4: Match History & Results

Status: ready-for-dev

## Story

As a user,
I want to view my ranked match results,
So that I can see how each of my tactics performed.

## Acceptance Criteria

1. **Given** I have completed ranked matches, **When** I view my match history, **Then** I see matches where I was challenger OR opponent, **And** each shows: opponent name, my tactic, score, result, elo change.

2. **Given** I filter by one of my tactics, **When** the history loads, **Then** only that tactic's matches are shown.

3. **Given** I click on a ranked match, **When** the details load, **Then** I can watch the replay with the same debug panel features as practice mode.

## Scope Boundary (read first)

- The history is a new **"Match history" section inside the existing `RankedView` overlay** (full-width, below the My fighters / Opponents columns). No route, no second top-level overlay — Winston's 4.3 decision stands: one overlay, the engine stays mounted underneath.
- Watching a replay from history reuses the **exact `onWatchReplay` prop path the result banner already uses** (AppShell closes the overlay, then `loadReplay(match.id, match)`). The whole replay pipeline — frames fetch, PixiJS playback, timeline scrubber, debug panel, player filtering — is shared with practice mode. Build **zero** new playback code (AC #3).
- **Ranked matches only** in this history: the backend gains an optional `?mode=` filter. The workspace "Watch last match" chip (story 3.8) keeps calling `GET /matches` unfiltered and must not change behavior.
- Only `completed` matches render — `failed` rows (engine failure, zero elo movement per 4.2) are hidden client-side: they are unwatchable and moved nothing.
- **Pagination = one "Load more" button.** The server already paginates 20/page. No date/opponent filters, no unread markers, no notifications for the offline opponent (4.3 v1 deferrals all stand).
- The tactic filter lists **all my non-system tactics**, not only ready ones — a retired tactic still owns its record.
- Tactic names shown are the tactic's **current** name (a rename rewrites history labels; accepted in v1 — match rows store tactic ids, which never leave the API per the serializer law).

## Tasks / Subtasks

### Backend Tasks (Laravel — `lachatadede-api/`)

- [ ] Task 1: History rows can name the fighters (AC: #1)
  - [ ] `MatchSerializer::toArray`: add `challengerTacticName` / `opponentTacticName` (null-safe through the relations; practice rows carry `challengerTacticName`, `opponentTacticName` stays null). Purely additive — existing `MatchTest` + `RankedMatchmakingTest` assertions stay green untouched.
  - [ ] `MatchController@index`: eager-load `challengerTactic`, `opponentTactic` next to `challenger`, `opponent`; add an optional `?mode=` filter (`in:practice,ranked`, absent param = no clause so `fetchLatestMatch` is untouched).
- [ ] Task 2: BOTH sides can open a match and its frames (AC: #3) — **bug fix, not new code**
  - [ ] `MatchController@show` and `MatchController@frames`: replace `Auth::user()->matches()->find($id)` — that relation is challenger-side only (`challenger_id`), so the offline opponent currently gets a **404 on replays of matches they lost**. Use `GameMatch::query()->forUser($user)->find($id)` (the scope shipped in 4.2). Non-participants must still 404 (`MatchTest::test_show_is_scoped_to_the_owner` stays green).
  - [ ] Feature tests (extend `tests/Feature/Matchmaking/RankedMatchmakingTest.php`):
    - history rows expose `challengerTacticName` / `opponentTacticName` (assert the fighter names, e.g. `'Mine'` / `'Theirs'`);
    - `?mode=ranked` excludes a practice match, `?mode=practice` excludes a ranked match, no param returns both;
    - the OFFLINE opponent gets 200 on `GET /matches/{id}` **and** `GET /matches/{id}/frames` for the match they lost;
    - a non-participant still gets 404 on both (regression guard).

### Frontend Tasks (React — `src/`)

- [ ] Task 3: Types + store (AC: #1, #2)
  - [ ] `types/shared.ts`: `MatchResult` gains optional `challengerTacticName?: string | null` and `opponentTacticName?: string | null`.
  - [ ] `stores/rankedStore.ts` — new history slice, same patterns as the pool slice: `historyMatches: MatchResult[]`, `isLoadingHistory`, `historyError`, `historyPage`, `historyLastPage`, `historyTacticId: string | null`; actions `fetchHistory(tacticId?)` (page 1, **replace**) and `loadMoreHistory()` (`&page=historyPage+1`, **append**). Endpoint: `GET /matches?mode=ranked` + `&tactic_id=` when filtered. 401 → dead-session logout (dynamic-import `authStore` precedent); failures use `getApiError` + a human fallback message; `reset()` clears the slice (authStore.logout already calls ranked reset — keep it that way).
- [ ] Task 4: My-perspective helpers (AC: #1)
  - [ ] New `src/lib/matchPerspective.ts`: `matchPerspective(match, myUsername)` → `{ amChallenger, myScore, theirScore, myPoints, outcome: 'win' | 'loss' | 'draw', opponentLabel, myTacticLabel }`. Side rule: `amChallenger = match.challengerName === myUsername` (usernames are unique); if `challengerName === null` (deleted user) I am necessarily the opponent. Pure functions, no store, no React (timeFormat.ts precedent).
- [ ] Task 5: RankedView history section (AC: #1, #2, #3)
  - [ ] Full-width `section` below `styles.columns`, same panel chrome (`#252526` / `#3c3c3c` / 8px radius). Header row: "Match history" + tactic filter `<select data-testid="ranked-history-filter">` ("All tactics" + my non-system tactics from `tacticsStore` by name).
  - [ ] Row (`data-testid="ranked-history-row"`, `data-match-id`): date (`createdAt`, short local format), opponent label, my tactic name, `myScore — theirScore`, result badge — Victory (green `#4ec9b0`) / Defeat (red `#f14c4c`) / Draw (muted) — signed elo delta (green/red, `pointsLabel`-style `+25` / `-25`), and a `▶ Watch replay` button → `onWatchReplay(match)`.
  - [ ] Render only `status === 'completed'` rows; loading / error+Retry / empty ("No ranked matches yet — quick-match a fighter to start its record.") states mirror the opponents section; hide the whole section's rows behind the same `!open` early-return as the rest of the view.
  - [ ] "Load more" button (`data-testid="ranked-history-load-more"`) when `historyPage < historyLastPage`; a filter change refetches page 1; opening the view AND settling a play both trigger `fetchHistory` (fresh match appears without reopening).
- [ ] Task 6: Unit tests
  - [ ] `tests/unit/lib/matchPerspective.test.ts`: challenger-win, opponent-loss, draw, deleted-challenger (`challengerName: null`), sign/label math.
  - [ ] `tests/unit/stores/ranked-store.test.ts`: history happy path, `tactic_id` param passthrough, load-more append vs page-1 replace, error + fallback message, 401 logout, `reset()` clears the slice.

### E2E (Playwright — `tests/e2e/ranked-matchmaking.spec.ts`)

- [ ] Task 7: History flow (engine-backed, serial mode, same file + shared fixtures)
  - [ ] Reuse the two-ready-fighters seed (A offline, B in browser): B challenges → result banner → A's context: open ranked view → history row shows B's name, A's tactic, a `N — N` score, "Defeat", a negative elo delta → select A's tactic in the filter → row remains → click `Watch replay` → overlay closes, workspace shows `field-canvas` with the score display (replay actually loaded).

## Verification

- Backend (workdir `lachatadede-api/`): `php artisan test --env=testing` green — the pre-existing `ExampleTest` sessions-table failure (documented in 4.2/4.3) is the only allowed red.
- Frontend (repo root): `npm run lint` 0 errors, `npx tsc -b` clean, `npm run test:unit` green (baseline 501 + new tests).
- E2E: `npx playwright test tests/e2e/ranked-matchmaking.spec.ts` green (chromium, workers=1; simulations can take ~120s each — allow the timeout, run under `caffeinate` on macOS). Full multi-browser sweep stays deferred to end-of-epic (Pelo, 4.3).
- Manual smoke: two users — challenge as B, then as the OFFLINE user A open Ranked → history row → Watch replay → debug panel + timeline behave like practice mode.

## Dev Notes

### Files being modified — current state (read before touching)

**`lachatadede-api/app/Http/Controllers/MatchController.php`** (UPDATE)
- `index()` (lines 106-133) already does the whole 4.4 query shape: `GameMatch::query()->forUser($user)` (both sides), optional owned `?tactic_id=` filter (foreign id → 404), eager `challenger`+`opponent`, `orderBy created_at desc`, `paginate(20)` → `->through(MatchSerializer::toArray)`. You are only ADDING two eager loads and one `mode` filter — do not restructure.
- `show()` (line 138) and `frames()` (line 154) scope via `Auth::user()->matches()` = `User::matches()` = `hasMany(GameMatch, 'challenger_id')` — **challenger side only**. This is the offline-opponent 404 bug this story fixes. `frames()` also has a completed-status check and a `realpath` containment guard on `frames_file` — keep both verbatim, only swap the lookup.
- `store()` (practice) is untouched by this story.

**`lachatadede-api/app/Http/Serializers/MatchSerializer.php`** (UPDATE)
- Single source of truth for the camelCase match shape; documented law: **no internal ids leak** (frames_file, tactic ids stay private) — that is why this story adds tactic *names*, not ids. Add the two name keys after `challengerName`/`opponentName`; null-safe `$match->challengerTactic?->name` (practice matches have no opponent tactic).

**`lachatadede-api/app/Models/GameMatch.php`** (READ — no changes expected)
- `scopeForUser` (line 122) already exists: challenger OR opponent. Relations `challengerTactic`/`opponentTactic` (lines 88-99) already exist — eager-loading them is all the index change needs.

**`src/types/shared.ts`** (UPDATE) — `MatchResult` (line 187) already carries `pointsChallenger`/`pointsOpponent`/`challengerName`/`opponentName` (4.2/4.3 additions). Add only the two tactic-name fields.

**`src/stores/rankedStore.ts`** (UPDATE)
- Established in-store patterns you must reuse: `playSeq` monotonic token for play actions; 401 → `handleDeadSession()` (dynamic `import('./authStore')` — a static import would close a cycle because authStore statically imports this store); `getApiError(error)` + per-slice fallback constants; `reset()` restores `initialState`; after a settled play the store refreshes `fetchOpponents()` + dynamically-imported `tacticsStore.fetchTactics()`.
- The paginator envelope is Laravel's default flat shape: `{ data: MatchResult[], current_page, last_page, total, per_page, ... }` — `fetchLatestMatch` in matchStore already reads `payload.data`; read `current_page`/`last_page` the same way.
- A fetch (unlike a play) does not need a seq token, but guard the *append*: `loadMoreHistory` must compute the target page before `await` and drop the response if the filter/page changed meanwhile (stale-response race — same philosophy as `replayLoadSeq`).

**`src/components/ranked/RankedView.tsx`** (UPDATE)
- Layout: opaque overlay (`position: fixed`, `zIndex: 500`, above workspace, below the 1600 replay-loading overlay), `topBar` (back button, title, spacer), banner stack, then `styles.columns` with two `panel` sections. Add the history `section` AFTER `styles.columns`, inside `styles.inner`, using the `panel` chrome.
- `outcomeLabel`/`pointsLabel` (lines 27-34) are **challenger-perspective** and used by the result banner — leave them; the history rows use the new `matchPerspective` helpers instead (the banner case is always "I am the challenger", history is not).
- Testid conventions: `ranked-*` prefix, `data-tactic-id` / `data-opponent-id` attributes, `role="status"`/`role="alert"` on banners. Follow them exactly — e2e depends on it.
- `myFighters` filter (`isReady && !isSystem`) is for the fighters column only; the history filter uses `tactics.filter(t => !t.isSystem)`.

**`src/components/layout/AppShell.tsx`** (READ — likely zero changes)
- `rankedOpen` state + `handleRankedWatchReplay` (line 438): closes the overlay FIRST, then `loadReplay(match.id, match)`. Keyboard shortcuts early-return while `rankedOpen` (line 520). Pass-through of `onWatchReplay` to `RankedView` already exists — history rows call the same prop, so AppShell needs **no changes** unless you find a real blocker.

**`src/lib/`** — new `matchPerspective.ts` sits beside `score.ts` / `timeFormat.ts` (pure display-concern libs, unit-tested under `tests/unit/lib/`).

### Perspective math (AC #1 — get the signs right)

- `amChallenger = match.challengerName === myUsername` (`authStore.user.username`; usernames are DB-unique). `challengerName === null` → the challenger user was deleted → I am the opponent.
- `myScore/theirScore` and `myPoints` swap on `!amChallenger`; `outcome`: `challenger_win` → win iff `amChallenger`; `opponent_win` → loss iff `amChallenger`; `draw` → draw (elo moved symmetrically, W/L counters untouched — 4.2).
- Elo delta display: signed, mine only (the opponent's mirrored delta is server-side data I also have — don't show it, this history is mine).

### Previous story intelligence (4.3 + 4.2 — same epic, uncommitted tree)

- 4.3: e2e engine canvas is selected via `data-testid="field-canvas"` (never a bare `<canvas>`); specs use the shared `apiContext` fixture (an undefined fixture = collection error); long e2e runs need `caffeinate` on macOS (sleep = mass timeouts); stale long-lived dev servers once faked a 4/4 failure — recycle servers before blaming code; `playSeq` staleness pattern was review-mandated.
- 4.2: elo is K=50 / start 1000, floored at 0, applied in one transaction with the match row; a failed simulation leaves a `failed` row with null points — that is exactly the row this story hides; serializer changes there were additive and `MatchTest` stayed green — same discipline here.
- End-of-epic full sweep is Pelo's ritual: run the whole playwright suite once after 4.5 lands, not per story (baseline-reproduced pre-existing firefox/webkit failures are filed, not yours to fix).

### Git intelligence

- HEAD `a3d02b0` ("feat(matchmaking): Add ranked queue and matchmaking (story 4.1)"); ALL of epic-4 v2 (4.1 rewrite, 4.2, 4.3) is uncommitted working tree — do not assume clean state, do not commit unless asked. Commit style when asked: `feat(history): ... (story 4.4)`.
- Working tree already touches MatchController / MatchSerializer / rankedStore / RankedView — read the CURRENT file contents, not the committed ones (the analysis above reflects the working tree).

### Testing standards

- Backend feature tests: PHPUnit + `RefreshDatabase`, `Http::fake()` engine double writing a real frames file (`fakeEngineSuccess` helper in `RankedMatchmakingTest` — reuse it; `GET /matches/{id}/frames` 200 requires a file on disk + `status completed`).
- Frontend unit: Vitest + jsdom, `vi.mock`/fetch-stub style per `tests/unit/stores/ranked-store.test.ts`; pure libs tested in `tests/unit/lib/` (see `field.test.ts` for style).
- E2E: `test.describe.configure({ mode: 'serial' })` per file, real Laravel + engine, 120s expect timeouts around simulations, API assertions via `apiContext` with `Authorization: Bearer <token>`.

### Project Structure Notes

- Frontend lives in repo root `src/` (React 18 + Zustand 5 + Vite + PixiJS 8); backend in `lachatadede-api/` (Laravel 12, PHP 8.2, Sanctum). No new dependencies anywhere in this story — refuse any temptation to add a date library or a table component; inline styles + `<select>` match the existing RankedView idiom.
- No `project-context.md` exists in the repo (verified) — the conventions above ARE the project context.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.4-Match-History-&-Results-rescoped] — ACs verbatim; epic header locks the challenge model (elo on tactic, draws hidden from W/L).
- [Source: _bmad-output/planning-artifacts/database-schema.md#MATCH] — points_challenger/opponent are the signed per-tactic elo deltas.
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Endpoints-API] — GET /api/matches, /{id}, /{id}/frames contract.
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Chosen-Direction] — VSCode dark palette used by RankedView chrome.
- [Source: _bmad-output/implementation-artifacts/4-2-ranked-match-engine.md] — history endpoint shipped here (Task 4), elo semantics, failed-row behavior.
- [Source: _bmad-output/implementation-artifacts/4-3-ranked-matchmaking-view.md] — overlay precedent, rankedStore patterns, e2e fixtures/learnings.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
