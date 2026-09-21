---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 4.5: Public Leaderboard

Status: done

## Story

As a user,
I want to view the public leaderboard,
So that I can see the top TACTICS ranked by elo.

## Acceptance Criteria

1. **Given** I navigate to leaderboard, **When** the page loads, **Then** I see tactics ranked by elo, **And** each entry shows: rank, owner, tactic name, elo, win/loss record.

2. **Given** I am logged in, **When** I view leaderboard, **Then** my tactics are highlighted.

3. **Given** I want to find a specific player, **When** I view the leaderboard, **Then** I can find their tactics and challenge them from the ranked view.

## Scope Boundary (read first)

- The leaderboard is a **new full-screen overlay** (`LeaderboardView`), NOT a route — Winston's 4.3 decision stands: full-screen AppShell view swap, the PixiJS engine stays mounted underneath. Opened from a new **Header nav button** ("🏆 Leaderboard", beside "⚔ Ranked") — AC #1 says "I navigate to leaderboard", so it is a destination, not a section inside `RankedView` (which is already 692 lines).
- **Elo lives on the TACTIC** (Epic 4 v2 law): the board ranks tactics, not players. The legacy `user.points` column (shown as "N pts" in the header dropdown) is untouched and must NOT appear here.
- **All non-system tactics appear** — ready or not, played or never played (4.4 precedent: a retired tactic still owns its record). Never-played tactics sit at elo 1000, 0-0. This also guarantees every logged-in user finds their own tactics (AC #2 works for brand-new users). System tactics (`is_system = true`) never appear.
- **No pagination.** The pool endpoint (`GET /matchmaking/opponents`) returns everything unpaginated; at NFR11 scale (100 users ≈ ~500 tactics) the full ranked list is fine. A "Load more" would be ceremony without a problem.
- **No challenge buttons on the leaderboard** (AC #3 is findability, not action): rows expose owner + tactic name so you can find players; the challenge action already lives in the ranked view's opponents pool. No deep-linking from leaderboard → ranked in v1.
- **Read-only surface**: no elo mutation, no new migration, no new index (the table is tiny; `orderByDesc('elo')` is a trivial sort).
- The API returns the **server-computed rank** (1-based position in elo-desc order). The client renders rows in payload order — never re-sorts, never recomputes ranks.

## Tasks / Subtasks

### Backend Tasks (Laravel — `lachatadede-api/`)

- [x] Task 1: The leaderboard endpoint (AC: #1, #3)
  - [x] New `app/Http/Controllers/LeaderboardController.php` with a single `index()` — thin controller, query inline (one read query does not justify a service; `MatchmakingController` delegates only because matchmaking has real logic).
  - [x] Route in `routes/api.php` inside the `auth:sanctum` group: `Route::get('/leaderboard', [LeaderboardController::class, 'index']);` (the endpoint name `GET /api/leaderboard` is pinned by backend-architecture.md; auth-gated like every other route — "public" means visible to all users, not anonymous visitors).
  - [x] Query: `Tactic::query()->with('user')->where('is_system', false)->orderByDesc('elo')->orderByDesc('wins')->orderBy('name')->orderBy('id')->get()` — the multi-key tie-break makes equal-elo ordering deterministic (PHP-stable `rank` numbering depends on it).
  - [x] Serialize to: `[{ rank, id, name, owner, elo, wins, losses }]` — `rank` is the 1-based loop index, `owner` is `$tactic->user?->username` (null-safe; schema cascades user deletes so null is defensive only). **No `players`, no script data** (NFR9), camelCase, no other keys.
  - [x] Feature tests (new `tests/Feature/Leaderboard/LeaderboardTest.php`, `RefreshDatabase`, following `RankedMatchmakingTest` style — see its `createUserTactic` helper for making tactics with custom `ranked` elo/wins/losses):
    - unauthenticated request → 401;
    - tactics ranked by elo desc, each row carries rank (1-based sequential), owner username, name, elo, wins-losses;
    - system tactics are excluded (seed one `is_system = true`);
    - a not-ready tactic and a never-played tactic (elo 1000, 0-0) both appear;
    - deterministic tie-break: two tactics at the same elo → higher wins first, then name asc;
    - shape guard: `assertJsonCount` + exact key assertion on a row (no `players` key, no script ids — negative assertions, the 4.4 serializer-law lesson).

### Frontend Tasks (React — `src/`)

- [x] Task 2: Type + store slice (AC: #1, #2)
  - [x] `types/shared.ts`: new `LeaderboardEntry { rank: number; id: string; name: string; owner: string | null; elo: number; wins: number; losses: number; }` placed under the `RankedOpponent` block.
  - [x] `stores/rankedStore.ts` — new leaderboard slice, same patterns as `fetchOpponents` (lines 106-127) and the history slice: `leaderboardEntries: LeaderboardEntry[]`, `isLoadingLeaderboard: boolean`, `leaderboardError: string | null`, action `fetchLeaderboard()` (GET `/leaderboard`, plain JSON array — no paginator envelope). Add to `initialState` and to `reset()`.
  - [x] Patterns you MUST reuse (4.4 review findings are binding): a `leaderboardSeq` module token guarding stale writes; 401 → `handleDeadSession()` (dynamic-import `authStore`) **with `isLoadingLeaderboard: false` set before the return**; failures via `getApiError(error)` + a `LEADERBOARD_FALLBACK_MESSAGE` constant.
- [x] Task 3: `LeaderboardView` component (AC: #1, #2) — new `src/components/leaderboard/LeaderboardView.tsx`
  - [x] Chrome mirrors `RankedView` exactly (copy its overlay anatomy): `position: fixed; inset: 0`, `#1e1e1e`, `zIndex: 500`, `overflowY: auto`, `inner` wrapper (`maxWidth: 1100px`, centered), topBar with back button (`data-testid="leaderboard-back-button"`, "← Back to workspace") + title `🏆 Leaderboard`. `if (!open) return null;` before any hooks-that-read-open logic like the ranked view does (effect on `open`, early return before the JSX).
  - [x] One `panel`-styled section (same `#252526` / `#3c3c3c` / 8px radius chrome) listing rows in payload order. Row (`data-testid="leaderboard-row"`, `data-tactic-id={entry.id}`): rank number (`data-testid="leaderboard-rank"`), owner (`data-testid="leaderboard-owner"`), tactic name (`data-testid="leaderboard-name"`), `elo` + `wins-losses` record (`data-testid="leaderboard-record"`, same `{elo} · {wins}-{losses}` format as ranked rows).
  - [x] Highlight my tactics (AC #2): `entry.owner === myUsername` (`useAuthStore` `user?.username ?? null`; usernames are DB-unique — `matchPerspective` precedent). Highlight = accent left border (e.g. `borderLeft: '3px solid #0e639c'`) + a `data-testid="leaderboard-you"` badge ("You"). This testid doubles as the e2e highlight assertion.
  - [x] Loading / error+Retry / empty states mirror the ranked opponents section: `leaderboard-loading`, `leaderboard-error` (+ `leaderboard-retry` button calling `fetchLeaderboard`), `leaderboard-empty` (copy: "No tactics on the board yet." — it only fires when the DB has zero non-system tactics, so no call-to-action is needed).
  - [x] Fetch on open: `useEffect(() => { if (open) void fetchLeaderboard(); }, [open, fetchLeaderboard]);` — refetch every open (elo moved since last time; no caching).
- [x] Task 4: Wiring (AC: #1)
  - [x] `AppShell.tsx`: `const [leaderboardOpen, setLeaderboardOpen] = useState(false);` next to `rankedOpen` (line ~41); pass `onOpenLeaderboard={() => setLeaderboardOpen(true)}` to `Header` (line ~558); render `<LeaderboardView open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />` right after `<RankedView>` (line ~758); extend the keyboard early-return to `if (rankedOpen || leaderboardOpen) return;` (line ~520) and add `leaderboardOpen` to that effect's dep array (line ~549).
  - [x] `Header.tsx`: new `onOpenLeaderboard: () => void;` prop; button `data-testid="leaderboard-nav-button"` ("🏆 Leaderboard") in the `startPracticeGroup` right after the ⚔ Ranked button (same `styles.button`).
- [x] Task 5: Unit tests
  - [x] `tests/unit/stores/ranked-store.test.ts` — leaderboard slice: happy path (array parsed, order preserved as-received), error + fallback message, 401 → logout spy fired **and `isLoadingLeaderboard` false after** (4.4 review lesson: assert the post-state, restore the spy), `reset()` clears the slice.

### E2E (Playwright — `tests/e2e/leaderboard.spec.ts`, new file)

- [x] Task 6: Leaderboard flow (engine-backed, serial mode)
  - [x] Copy the per-file `createReadyFighter` helper from `ranked-matchmaking.spec.ts` (file-local helpers are the precedent) — two users with **fixed names** (`LeaderA`, `LeaderB`; e2e DB is `migrate:fresh` per run so fixed usernames are safe — 4.4 lesson).
  - [x] Settle one real match via API as B: `apiContext.post('matchmaking/quick', { data: { tactic_id: b.tacticId }, headers: { Authorization: Bearer b.token } })` (synchronous, allow ~120s timeout; a weak-A fixture — 5 idle `me.stop()` scripts — is NOT needed here, any outcome moves elo).
  - [x] Open the app as A (`seedAuthToken` + `/workspace`), click `leaderboard-nav-button` → `leaderboard-view` visible.
  - [x] Assert: ≥2 `leaderboard-row`s; the winning tactic's row ranks above the loser's (elo moved apart); each row shows a numeric rank, owner text, and a `elo · W-L` record; A's own row carries `leaderboard-you`, B's row does not (AC #1 + #2 in one pass).
  - [x] Back button → `leaderboard-view` hidden, `field-canvas` visible (engine stayed mounted).

### Review Findings

*Code review 2026-09-21 (gds-code-review — Blind Hunter + Edge Case Hunter + Acceptance Auditor; 11 findings dismissed as noise/spec-pinned after repo verification):*

- [x] [Review][Patch] E2E: `GET /tactics` response used without an `ok()` check; `find(...)!` non-null assertion throws a bare TypeError masking the real setup failure [tests/e2e/leaderboard.spec.ts:100-105] — fixed 2026-09-21 (ok() guard + descriptive throws; lint 0 errors, tsc -b clean)
- [x] [Review][Defer] Cache the hot read endpoint (30–60s `Cache::remember`) — elo only changes on match settlement; revisit at NFR11 scale growth [lachatadede-api/app/Http/Controllers/LeaderboardController.php:16] — deferred, spec-pinned minimalism
- [x] [Review][Defer] Overlay a11y: Escape-to-close, focus trap/initial focus, list semantics, aria-live on loading/error — RankedView (4.3) has the identical gaps; epic-level pass [src/components/leaderboard/LeaderboardView.tsx:45-121] — deferred, pre-existing pattern

## Dev Notes

### Files being modified — current state (read before touching)

**`lachatadede-api/routes/api.php`** (UPDATE)
- One new line inside the `auth:sanctum` group. Do NOT add throttle groups — the default `throttle:api` applies (matches every other read route; only auth and matchmaking have dedicated limiters).

**`app/Http/Controllers/LeaderboardController.php`** (NEW)
- Look at `MatchmakingController.php` for the thin-controller + `response()->json(...)` idiom and `TacticController::serializeTactic()` (line 262) for the camelCase serializer law: **script references and code never leave the API** (NFR9). The leaderboard shape is deliberately NOT `serializeTactic` (no players array; adds rank + owner) — write a small private serializer in the controller, do not shoehorn the existing one.
- `Tactic` model already casts `elo`/`wins`/`losses` to int and `user()` relation exists (`app/Models/Tactic.php`) — `with('user')` is the only eager load you need (one query, no N+1; the 4.4 eager-load review finding).

**`src/types/shared.ts`** (UPDATE)
- `RankedOpponent` (lines 222-229) is the closest existing shape; `LeaderboardEntry` goes right under it. `rank` is a number computed server-side — the client must not recompute it on ties or after client-side sorting (it must not sort at all).

**`src/stores/rankedStore.ts`** (UPDATE)
- The store is the Epic-4 store now (opponents + play + history slices live here). Add the leaderboard slice the same way 4.4 added history: state in `RankedState` + `initialState`, action in `RankedActions`, `reset()` bumps `leaderboardSeq` and restores `initialState` (authStore.logout already calls this store's `reset()` — one reset path, no authStore changes).
- `fetchOpponents` (lines 106-127) is your template: `apiFetch('/leaderboard')`, `response.json() as LeaderboardEntry[]` (plain array — NOT the paginator envelope), 401 → dynamic-import logout, error path uses `getApiError` + fallback constant.
- The seq-token dance: `const seq = ++leaderboardSeq;` at start, `if (seq !== leaderboardSeq) return;` after the await, on error too. Single fetch, no append — simpler than history.

**`src/components/leaderboard/LeaderboardView.tsx`** (NEW)
- `src/components/ranked/RankedView.tsx` is the chrome source of truth: `styles.overlay` (line 479), `inner` (486), `topBar` (495), `panel` (570), `row` (609), `emptyText` (652) — copy those style blocks; keep all colors from the VSCode dark palette (`#1e1e1e`, `#252526`, `#3c3c3c`, `#cccccc`, `#9d9d9d`, `#0e639c`, `#4ec9b0`, `#f14c4c`). Inline styles + no new components — no table library, no UI kit (project law).
- Component shape: read store via `useRankedStore()`, `myUsername` via `useAuthStore((state) => state.user?.username ?? null)` (exact idiom from `RankedView.tsx` line 81), effect-on-open fetch, `if (!open) return null;` before the return JSX (same as `RankedView.tsx` line 121).
- `id` in the payload is the tactic id — used for `data-tactic-id` and React keys only. Do not build challenge actions from it (scope boundary).

**`src/components/layout/AppShell.tsx`** (UPDATE — 4 small touchpoints)
- `rankedOpen` state block (lines 38-41): add the sibling state with the same comment style.
- Keyboard effect (lines 516-549): the guard at line 520 and the dep array at line 549 must both learn `leaderboardOpen` — forgetting the dep array is the classic regression here (stale closure leaves Space/arrow keys live under the overlay).
- Header invocation (line 554-559) and the `RankedView` render block (lines 756-761): mirror exactly for the new overlay. No replay hand-off needed — the leaderboard has no watch buttons.

**`src/components/layout/Header.tsx`** (UPDATE)
- Props interface (lines 10-19) + one button in the `startPracticeGroup` (lines 66-91). Copy the `ranked-nav-button` button verbatim, change testid/label/onClick. No disabled state — the leaderboard is always reachable.

### Perspective math (AC #2 — get the highlight right)

- Mine ⇔ `entry.owner === myUsername`. `owner` is the tactic owner's username; usernames are DB-unique. `myUsername` can be null in unauthenticated states, but the view only mounts behind the auth gate — still, `null === entry.owner` would be false anyway (owner is a string for non-system tactics), so no flip risk (the 4.4 "null myUsername flip" dismissal applies here too).
- Highlight is additive chrome (border + badge) — the row content (rank, owner, name, record) is identical for mine and others.

### Elo semantics you must not "fix"

- Draws move elo symmetrically but never touch W/L counters (4.2 law, Pelo decision) — a tactic showing `1025 elo · 0-1` is CORRECT (it drew or drew-heavy). Do not add a draws column, do not reconcile the numbers.
- elo is floored at 0. A 0-elo tactic ranks last but still shows (record ownership).
- Ties are possible (two tactics both never played = both 1000). The server tie-break (wins desc, name asc, id asc) guarantees a stable rank 1..N; the client renders as-received.

### Previous story intelligence (4.4 + 4.3 + 4.2 — same epic)

- **4.4 review findings that bind this story:** 401 paths must clear their loading flag before the logout return AND the unit test must assert that post-state; error surfaces render Retry in place and hide pagination-adjacent chrome while errored; seq tokens guard every async write; serializer privacy needs NEGATIVE assertions (assert forbidden keys absent), not just positive ones; eager-load relations the serializer touches (here: `user`).
- **4.3/4.4 e2e learnings:** engine canvas is `data-testid="field-canvas"` (never bare `canvas`); specs import fixtures from `../support/fixtures` (`userFactory`, `scriptFactory`, `matchFactory`, `apiContext`) — an undefined fixture name = collection error; serial mode per file; simulations can take ~120s (set generous expect timeouts, run under `caffeinate` on macOS); stale long-lived dev servers once faked failures — recycle before blaming code; fixed usernames are safe (DB is `migrate:fresh` per run) and make assertions deterministic.
- **4.2:** elo K=50 / start 1000 / floor 0, applied in one transaction — the leaderboard endpoint must NOT wrap anything in a transaction or lock anything (pure read).
- End-of-epic full multi-browser sweep stays Pelo's ritual (after 4.5 lands, per 4.3) — chromium-only for this story's e2e.
- Untracked working-tree files (`lachatadede-engine/src/engine/bots/demo/`, `scripts/assign-demo-tactics.php`) are demo-tactic seeding, unrelated to this story — leave them alone. Note: demo tactics are owned by real users (`owner_email`), NOT `is_system` — they legitimately appear on the leaderboard as fighters.

### Git intelligence

- HEAD `75f3e9e` ("feat(history): Add match history and results (story 4.4)"); working tree clean except the untracked demo-bot files above. Commit style when asked: `feat(leaderboard): ... (story 4.5)`.

### Testing standards

- Backend: PHPUnit + `RefreshDatabase`; assertion style per `RankedMatchmakingTest` (`assertJsonFragment`, `assertJsonCount`, exact-shape guards). Run from `lachatadede-api/`. The pre-existing `ExampleTest` sessions-table failure (documented in 4.2/4.3/4.4) is the only allowed red.
- Frontend unit: Vitest + jsdom; store tests follow `tests/unit/stores/ranked-store.test.ts` (fetch-stub / `vi.mock` style, spy hygiene).
- E2E: new spec file, `test.describe.configure({ mode: 'serial' })`, real Laravel + engine, API assertions via `apiContext` with `Authorization: Bearer <token>`.
- Lint/type gates: `npm run lint` (0 errors), `npx tsc -b` clean, from repo root.

### Project Structure Notes

- Frontend lives in repo root `src/` (React 18 + Zustand 5 + Vite + PixiJS 8); backend in `lachatadede-api/` (Laravel 12, PHP 8.2, Sanctum). **No new dependencies anywhere in this story** — refuse any temptation to add a table component, a sort library, or a date library; inline styles + existing palette match the RankedView idiom.
- New component directory: `src/components/leaderboard/` (sibling of `src/components/ranked/`) — same one-component-per-directory pattern.
- No `project-context.md` exists in the repo (verified) — the conventions in this file ARE the project context.
- Web research: none required — every library in this story is already pinned by the codebase (React 18, Zustand 5, Laravel 12); the endpoint adds no external integrations.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.5-Public-Leaderboard-rescoped] — ACs verbatim; epic header locks the challenge model (elo on tactic).
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Endpoints-API] — `GET /api/leaderboard` contract; LeaderboardController named in the Laravel service structure.
- [Source: _bmad-output/planning-artifacts/database-schema.md#TACTIQUE] — `is_ready`/`elo`/`wins`/`losses` on the tactic; `is_system` excludes training tactics.
- [Source: _bmad-output/planning-artifacts/prd.md#Leaderboard-&-Rankings] — FR40-FR43 (FR43 = rankings update per match, already satisfied by 4.2's transactional elo write; this story only reads).
- [Source: _bmad-output/implementation-artifacts/4-4-match-history-and-results.md] — store patterns (seq tokens, 401 flag discipline), review-findings lessons, e2e fixture conventions, serial-mode learnings.
- [Source: _bmad-output/implementation-artifacts/4-3-ranked-matchmaking-view.md] — full-screen overlay precedent (no route, engine stays mounted), RankedView chrome, `ranked-*` testid conventions.
- [Source: _bmad-output/implementation-artifacts/4-2-ranked-match-engine.md] — elo semantics (K=50, floor 0, draws hidden from W/L), pool query shape.

## Dev Agent Record

### Agent Model Used

euria-code (infomaniak/euria-code) — opencode, 2026-09-21

### Debug Log References

- Backend RED→GREEN: 6 feature tests written first (all 404 pre-route), then controller + route made them pass. Two RED-phase test bugs were fixed in the TESTS, not the controller: (1) tie-break expectation violated the stated rule (equal elo + equal wins must break by name asc — restructured the fixture so wins-desc and name-asc are both exercised), (2) shape-guard asserted rank on the wrong array index (`json('1')` is rank 2, not 1).
- Full-suite e2e failure #1 (my spec, fixed): `toHaveCount(2)` assumed a fresh board, but earlier specs (auth) leave not-ready default tactics behind (18 × "resolved to 14 elements"). Rewrote to story spec ("≥2 rows"): locate A/B rows by compound `[data-testid="leaderboard-row"][data-tactic-id="…"]` locator, compare winner/loser positions via `evaluateAll` on the payload order. First rewrite used `filter({ has: … })` which matches descendants only — `data-tactic-id` lives ON the row — that failed solo; compound locators fixed it (verified solo + after auth.spec seeds leftovers).
- Full-suite e2e failure #2 (NOT this story): `workspace.spec.ts:174` "should display code content in Monaco editor" hit a `waitForSelector` timeout under suite load. It passed 55/55 when the file ran in isolation — Story 2.2 files untouched by this story; load flake, no action.
- Full-suite e2e sweep (chromium): 91/93 passed (17.9m); both failures accounted for above.

### Completion Notes List

- Backend: `LeaderboardController@index` is a thin controller — one read query (`where('is_system', false)`, `orderByDesc elo/wins`, `orderBy name/id`), eager-loads `user`, serializes inline to `{ rank, id, name, owner, elo, wins, losses }` with 1-based rank. No transaction, no lock (pure read per 4.2 law). Route added inside `auth:sanctum`, default `throttle:api` (no new limiter).
- Frontend: `LeaderboardEntry` type under `RankedOpponent` in `types/shared.ts`; leaderboard slice added to `rankedStore` (state + action + `initialState` + `reset()` with `leaderboardSeq++`), seq-token guard on every post-await write, 401 path sets `isLoadingLeaderboard: false` BEFORE the logout return (4.4 binding review finding). `LeaderboardView` mirrors `RankedView` chrome (overlay/inner/topBar/panel, VSCode palette, inline styles, no new deps); highlight = `#0e639c` left border + "You" badge when `entry.owner === myUsername`; refetch on every open; loading/error+Retry/empty states with the pinned testids.
- Wiring: AppShell has the sibling `leaderboardOpen` state, Header prop + render after `RankedView`, and the keyboard early-return + dep array both know `leaderboardOpen` (the classic stale-closure regression was checked). Header gains the 🏆 Leaderboard button after ⚔ Ranked.
- Tests: 6 backend feature tests, 6 store unit tests (happy path as-received order, API error, fallback, 401 post-state + spy restore, stale-response drop, reset), 1 engine-backed e2e flow. Totals after this story: backend 114 passed (598 assertions), unit 524 passed, e2e leaderboard 1 passed.
- Spec deviation (documented): the e2e asserts winner-above-loser via relative list positions instead of `rows.nth(0/1)` — the full-suite DB legitimately carries not-ready elo-1000 tactics from earlier specs, and the census must show them (scope boundary "all non-system tactics appear"); the story's "≥2 rows" wording is honored. Quick-match determinism was verified instead of changed: register provisions scripts only and workspace default tactics have `scriptId: null` (never ready), so B's quick match can only draw A's ready tactic.
- No new dependencies; untracked demo-bot files (`lachatadede-engine/src/engine/bots/demo/`, `scripts/assign-demo-tactics.php`) untouched per story notes.

### File List

- lachatadede-api/app/Http/Controllers/LeaderboardController.php (new)
- lachatadede-api/routes/api.php (modified)
- lachatadede-api/tests/Feature/Leaderboard/LeaderboardTest.php (new)
- src/types/shared.ts (modified)
- src/stores/rankedStore.ts (modified)
- src/components/leaderboard/LeaderboardView.tsx (new)
- src/components/layout/AppShell.tsx (modified)
- src/components/layout/Header.tsx (modified)
- tests/unit/stores/ranked-store.test.ts (modified)
- tests/e2e/leaderboard.spec.ts (new)

## Change Log

- 2026-09-21 — Story 4.5 implemented: `GET /api/leaderboard` (server-ranked census of all non-system tactics), `LeaderboardView` full-screen overlay opened from a new Header nav button, leaderboard slice in `rankedStore`, wiring + keyboard guard in `AppShell`; 6 backend feature tests, 6 store unit tests, 1 engine-backed e2e spec. Status → review.
