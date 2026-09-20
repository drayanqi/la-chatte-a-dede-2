---
baseline_commit: a2c77279dd46d63a43b78f80a2888b2f6f77851f
---

# Story 4.1: Ranked Queue & Matchmaking

Status: superseded — the polling-queue model was replaced by the challenge model (Epic 4 v2, Pelo, 2026-09-19). See `4-1-ready-tactics-and-queue-removal.md` (which also removes this story's code) and `epics.md` Epic 4.

## Story

As a user,
I want to queue for ranked matches against other players,
So that I can compete and prove my AI skills.

## Acceptance Criteria

1. **Given** I have a valid lineup configured, **When** I click "Queue Ranked", **Then** I am added to the matchmaking queue, **And** I see "Searching for opponent...".

2. **Given** another player is in queue with similar rating, **When** matchmaking runs, **Then** we are paired together, **And** a ranked match is created.

3. **Given** no opponent is found within 30 seconds, **When** the timeout occurs, **Then** I see "No opponent found, try again later", **And** I am removed from queue.

4. **Given** I am in queue, **When** I click "Cancel", **Then** I am removed from queue.

## Scope Boundary (read first)

- **This story creates the ranked match row only — it does NOT simulate it.** The match is created with `status: 'pending'`, `mode: 'ranked'`. Server-side simulation, pending/completed status display, and notifications are Story 4.2; results view + rating changes are 4.3/4.4. The frontend must NOT offer "Watch Replay" or score display for ranked matches in this story (the row has no frames).
- **No new npm/composer dependencies.** Everything is built with existing stack: Laravel 12 (PHP 8.2), MySQL/sqlite, React 18, Zustand 5, Vitest, Playwright.

## Tasks / Subtasks

### Backend Tasks (Laravel — `lachatadede-api/`)

- [x] Task 1: `matchmaking_queue` table migration (AC: #1, #2, #3, #4)
  - [x] Columns: uuid PK, `user_id` FK users (unique index — a user holds at most one queue row), `tactic_id` FK tactics, `rating` int (snapshot of `users.points` at enqueue), `status` ENUM('waiting','matched','cancelled','expired') default 'waiting', nullable `match_id` FK matches, `joined_at` timestamp, timestamps
  - [x] Docblock noting the row survives terminal states for audit; "removed from queue" (AC #3/#4) means status leaves 'waiting', the row is never deleted
- [x] Task 2: Extract a shared match serializer (reuse, don't duplicate)
  - [x] Move `MatchController::serializeMatch()` into a static `App\Http\Serializers\MatchSerializer::toArray(GameMatch $match): array` — identical camelCase shape (`id, mode, status, scoreChallenger, scoreOpponent, result, durationFrames, createdAt`) — and update `MatchController` to call it
  - [x] `MatchTest` must stay green unchanged (shape contract locked by existing tests)
- [x] Task 3: `MatchmakingService` (`app/Services/MatchmakingService.php`) — pairing core (AC: #2, #3)
  - [x] `const TIMEOUT_SECONDS = 30`
  - [x] `join(User $user, Tactic $tactic): array` — upsert into queue (reactivate the user's existing row: status→waiting, new tactic/rating/joined_at); inside `DB::transaction` + `lockForUpdate` on candidate rows, attempt pairing; returns `['status' => 'waiting']` or `['status' => 'matched', 'match' => GameMatch]`
  - [x] Pairing: among `waiting` rows of OTHER users with `joined_at >= now - 30s` and a still-complete tactic (5 slots, each with a script — re-validate at pair time, skip candidates whose lineup broke), pick the candidate with the smallest `abs(rating difference)` (ties → oldest `joined_at`); create `GameMatch`: `challenger_id` = earlier joiner, `opponent_id` = later joiner, tactics accordingly, `mode: 'ranked'`, `seed: random_int(1, 2**31-1)`, `status: 'pending'`, scores 0 / result null / points null; mark both rows `matched` with `match_id`
  - [x] `status(User $user): array` — lazy-expire the user's own row if `joined_at` older than 30s (status→'expired') and return `['status' => 'timeout']`; if row is waiting → `['status' => 'waiting']`; matched → `['status' => 'matched', 'match']`; no row / cancelled / expired → `['status' => 'idle']`
  - [x] `cancel(User $user): void` — waiting row → status 'cancelled' (idempotent: no-op when no waiting row)
- [x] Task 4: `MatchmakingController` + routes (AC: #1, #2, #3, #4)
  - [x] `POST /api/matchmaking/queue` body `{tactic_id}` — auth (401), tactic must exist and belong to user (404), lineup complete else 422 `{message: 'Tactic lineup is incomplete'}` (same message as practice); idempotent re-join returns current state; 200 with the service's return (match serialized via `MatchSerializer`)
  - [x] `GET /api/matchmaking/queue` — 200 with the service's status return (match serialized when matched)
  - [x] `DELETE /api/matchmaking/queue` — always 204 (idempotent)
  - [x] Register all three under the existing `auth:sanctum` group in `routes/api.php` with a `// Matchmaking API` comment block
- [x] Task 5: Feature tests `tests/Feature/Matchmaking/MatchmakingTest.php` (pattern: `tests/Feature/Matches/MatchTest.php` — RefreshDatabase, `createUserTactic` helper, no engine HTTP calls)
  - [x] Join: unauthenticated 401; waiting response; incomplete lineup 422; other user's tactic 404; idempotent re-join (second POST returns waiting, still one row)
  - [x] Pairing: A joins then B joins → both polls return `matched` with the SAME match id; match row asserts mode 'ranked', challenger = earlier joiner, opponent = later joiner, both tactics, seed > 0, status 'pending'
  - [x] Rating preference: A (0 pts) and B (100 pts) waiting; C (95 pts) joins → pairs with B, A still waiting
  - [x] Timeout: join, then set `joined_at` to now−31s, poll → `timeout` + row status 'expired'; a later joiner does NOT pair with the expired row
  - [x] Cancel: waiting → DELETE → poll `idle`; DELETE with no row → 204
  - [x] Self-pairing guard: a user never pairs with their own row (single-user queue + join flow implies it — assert A alone polling stays `waiting`)

### Frontend Tasks (React — `src/`)

- [x] Task 6: Types + `matchmakingStore` (`src/stores/matchmakingStore.ts`, Zustand, pattern: `matchStore.ts`) (AC: #1, #2, #3, #4)
  - [x] `MatchmakingStatus` type in `src/types/shared.ts`: `UnionMatchmakingStatus = 'idle' | 'waiting' | 'matched' | 'timeout'`; API status payload `{status, match?: MatchResult}` (reuses existing `MatchResult`)
  - [x] State: `queueStatus: 'idle' | 'joining' | 'waiting' | 'matched' | 'timeout' | 'error'`, `match: MatchResult | null`, `error: string | null`; actions `joinQueue(tacticId)`, `pollStatus()`, `cancelQueue()`, `reset()`
  - [x] Polling contract: the COMPONENT owns the interval (2s, `setInterval` in a `useEffect` keyed on `queueStatus === 'waiting'`); the store exposes `pollStatus()` with a sequence token + the `replayLoadSeq` stale-response pattern (a poll response from a cancelled/superseded poll must never write state); 401 during poll → logout via dynamic `authStore` import (matchStore precedent)
  - [x] `joinQueue`: guard double-join; on 422 surface the server message; `cancelQueue`: DELETE then `idle`; `reset()` back to initial (logout cleanup — wire it into `authStore.logout()` next to the existing `matchStore.reset()` call)
- [x] Task 7: `QueueStatusBanner` component (`src/components/layout/QueueStatusBanner.tsx`, presentational, pattern: `MatchStatusOverlay.tsx`) + wiring (AC: #1, #2, #3, #4)
  - [x] Waiting: toast-style banner (fixed top, non-blocking — the user can keep browsing) "Searching for opponent..." + Cancel button
  - [x] Matched: "Match found!" (dismiss button; no replay/score — 4.2's territory)
  - [x] Timeout: "No opponent found, try again later" (dismiss)
  - [x] Error: error message + dismiss
  - [x] Header: "Queue Ranked" button next to "Test vs Bot" (UX spec header order), `data-testid="queue-ranked-button"`; disabled when `!lineupComplete || isSimulating || queueActive`; same helper-message pattern for the incomplete-lineup case is NOT required (Test vs Bot already shows it)
  - [x] AppShell wiring: mutual exclusion — while queued, "Test vs Bot" is disabled too (one active flow at a time); pass `onStartQueue` (joins with `activeTactic.id`, same lineup guard as practice) and render the banner above the existing `MatchStatusOverlay`
- [x] Task 8: Frontend unit tests
  - [x] `tests/unit/stores/matchmaking-store.test.ts` (convention: global `fetch` mock, NOT vi.mock of apiClient): join waiting → waiting; join matched → matched+match; poll transitions waiting→matched and waiting→timeout; cancel → idle; double-join ignored; stale poll response ignored (sequence token)
  - [x] `tests/unit/components/queue-status-banner.test.tsx`: renders each state with the right testids and texts; Cancel calls the handler

### E2E Tasks (Playwright — `tests/e2e/`)

- [x] Task 9: `tests/e2e/ranked-queue.spec.ts` (two browser contexts in one test; `test.describe.configure({ mode: 'serial' })` + single-worker note like practice-match.spec.ts; register both users via UI or `seedAuthToken` + API factories per existing helpers)
  - [x] Pair flow: users A and B each with a complete lineup (assign StarterAI to 5 slots via tactic tabs, reuse practice spec's setup); A clicks "Queue Ranked" → sees "Searching for opponent..."; B queues in context 2 → BOTH see "Match found!" (poll latency allowance ~5s)
  - [x] Cancel flow: A queues alone → Cancel → banner disappears, button re-enabled
  - [x] Timeout flow: A queues alone → after ~30s sees "No opponent found, try again later" (test.setTimeout(90_000); this is the only true full-stack proof of AC #3 — keep it despite the wait)
  - [x] No regression: `practice-match.spec.ts` still passes (serial mode)

## Dev Notes

- **Why a DB table + polling, not Redis/WebSocket:** PRD locks "REST (no WebSocket), polling for async match results" (prd.md#Web Application Requirements); scale target is 100 concurrent users (NFR11); `QUEUE_CONNECTION=database` exists but background jobs are story 4.2's concern (server-side simulation on pairing). A single `matchmaking_queue` table with `lockForUpdate` transactions is the smallest correct thing.
- **Engine is NOT touched in this story.** No `/simulate` calls from the matchmaking path. The engine's `/simulate` is CPU-bound and blocks its single event loop (deferred-work.md#61) — pairing MUST NOT simulate synchronously or the second player's HTTP request hangs for seconds. 4.2 introduces the async completion strategy.
- **Rating = `users.points`** (default 0, integer cast, migration `0001_01_01_000000_create_users_table.php:19`). Points deltas (+3/+1/-1) land in 4.4; 4.1 only snapshots points for similarity. "Similar rating" is implemented as closest-rating-wins among waiting candidates — with a tiny player pool FIFO and similarity nearly coincide, and the preference is cheap to test.
- **Challenger side rule:** earlier joiner = `challenger_id`. The engine payload mirrors the opponent's coordinates (GameEngineService), but that's 4.2's problem — just persist sides correctly now.
- **Race safety (non-negotiable):** pairing runs inside `DB::transaction` with `lockForUpdate` on candidate rows; `users.id` unique index on `matchmaking_queue` backstops double-join races (unique violation → catch + retry as idempotent re-join). Two simultaneous joins must produce exactly one match, never two.
- **Tactic mutation while queued:** a user can edit/delete their tactic between join and pairing. Pairing re-validates candidate tactics (5 slots × script present) and skips broken ones — never create a ranked match with an incomplete lineup (breaks the 4.2 engine payload). The joiner's own tactic is validated at join time only.
- **Match visibility:** `GameMatch::scopeOwnedBy` filters `challenger_id` only, so the opponent's `GET /api/matches*` 404s for ranked matches. Do NOT change it in this story — both players discover the match through the matchmaking status endpoint (match_id on their queue row). Broader visibility (matches index including opponent side) belongs to 4.3 (results view).
- **Serialization:** reuse one serializer (Task 2). The match JSON shape is the frontend's `MatchResult` contract — do not invent a second shape.
- **Frontend conventions:** `apiFetch` for all HTTP; inline styles (no CSS framework); `data-testid` on every interactive/assertable element; English-only code/comments; Zustand actions never call `set` after an awaited response without a sequence-token guard (matchStore `replayLoadSeq` pattern, review-proven).
- **Dev-stack constraint for E2E:** `php artisan serve` is a single PHP worker — two contexts polling every 2s is fine (requests are ms-fast), but do NOT raise parallelism in playwright.config.ts (deferred-work.md#73: local full-parallel starves the shared stack; CI runs workers:1).
- **Timeout timing:** the 30s window is measured from `joined_at` server-side. Poll cadence (2s) means the client shows the timeout message up to ~2s after expiry — acceptable. Do not add jittered/expiry countdown UI.
- **What NOT to build:** no leaderboard (4.5), no Elo math (4.4), no match-history UI (4.3), no pending-match status page (4.2), no rating display changes in the header dropdown.

### Test Selectors

| Selector | Element |
|----------|---------|
| `[data-testid="queue-ranked-button"]` | "Queue Ranked" header button |
| `[data-testid="queue-searching-banner"]` | "Searching for opponent..." banner |
| `[data-testid="queue-cancel-button"]` | Cancel button in the searching banner |
| `[data-testid="queue-matched-banner"]` | "Match found!" banner |
| `[data-testid="queue-timeout-banner"]` | "No opponent found, try again later" banner |

### Project Structure Notes

- New: `lachatadede-api/database/migrations/2026_09_17_000000_create_matchmaking_queue_table.php`, `app/Services/MatchmakingService.php`, `app/Http/Controllers/MatchmakingController.php`, `app/Http/Serializers/MatchSerializer.php`, `tests/Feature/Matchmaking/MatchmakingTest.php`
- New: `src/stores/matchmakingStore.ts`, `src/components/layout/QueueStatusBanner.tsx`, `tests/unit/stores/matchmaking-store.test.ts`, `tests/unit/components/queue-status-banner.test.tsx`, `tests/e2e/ranked-queue.spec.ts`
- Update: `src/types/shared.ts` (+ barrels `src/types/index.ts`, `src/stores/index.ts` if they export store lists), `src/components/layout/AppShell.tsx`, `src/components/layout/Header.tsx`, `src/stores/authStore.ts` (reset wiring), `lachatadede-api/app/Http/Controllers/MatchController.php` (serializer extraction only), `lachatadede-api/routes/api.php`

### Previous Story Intelligence

- From 3.5 (practice trigger — closest analog): controller validation style (`$request->validate` + same "Tactic lineup is incomplete" 422 message), engine-failure row hygiene (never leave a row pending forever — here: pairing failure must not leave half-matched queue rows; the transaction covers it), test conventions (`createUserTactic` helper, `Http::fake` NOT needed here since the engine is never called).
- From 3.5 review findings still relevant: retry/guard paths must enforce the same lineup checks as the primary path; store error paths must surface friendly messages, not raw browser jargon (ApiError → `getApiError`, non-HTTP → human fallback).
- From matchStore (3.8 review): sequence tokens for every async store action with awaits; 401 → dynamic `authStore` import + logout (static import would close a cycle).
- From deferred-work.md: no animated spinners (minimal text banners, matches "Simulating..." precedent); single-worker dev server constrains e2e parallelism.
- Header button pattern (story 3.2/3.5): disabled style object + `disabled` attribute + helper span with its own testid when lineup incomplete.

### Project Context Rules

- No `project-context.md` exists in the repo. Enforced project rules extracted from the codebase itself:
  - TypeScript strict, pnpm/Vite, path alias `@/` → `src/`
  - Zustand for all cross-component state; stores own their async error states
  - All HTTP via `src/lib/apiClient.ts` (`apiFetch`, `ApiError`, `getApiError`)
  - Backend: Laravel 12 conventions, `HasUuids` models, camelCase public JSON (snake_case DB), feature tests extend `Tests\TestCase` + `RefreshDatabase`
  - Vitest (`tests/unit/**`), Playwright (`tests/e2e/**`, config at repo root, 3 webServers: api/vite/engine)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1: Ranked Queue & Matchmaking]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4: Ranked Competition & Leaderboard] (cross-story: 4.2 async completion, 4.3 results view, 4.4 ratings, 4.5 leaderboard)
- [Source: _bmad-output/planning-artifacts/prd.md#Competitive Play] (FR23-FR26), [Source: prd.md#Web Application Requirements] (REST-only, polling)
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Service Laravel] (controller/service layout, PointsService placeholder)
- [Source: _bmad-output/planning-artifacts/database-schema.md#MATCH] (points +3/+1/-1 intent — 4.4)
- [Source: lachatadede-api/app/Http/Controllers/MatchController.php] (validation + lineup gate + serialize shape to extract)
- [Source: lachatadede-api/database/migrations/2026_09_14_000000_create_matches_table.php] (ranked superset: mode enum, opponent sides, points columns already exist)
- [Source: src/stores/matchStore.ts] (store patterns: sequence tokens, 401 logout, apiFetch)
- [Source: src/components/layout/MatchStatusOverlay.tsx] + [Source: src/components/layout/Header.tsx] (banner/button patterns)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Panel Layout] (header order: [Test vs Bot] [Queue Ranked])
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] (engine event-loop constraint, e2e parallelism constraint, spinner anti-pattern)
- [Source: tests/Feature/Matches/MatchTest.php], [Source: tests/support/fixtures/factories/user-factory.ts], [Source: tests/support/helpers/auth.ts] (test patterns)

## Dev Agent Record

### Agent Model Used

euria-code (Infomaniak)

### Debug Log References

- Unit `matchmaking-store.test.ts`: the double-join test staged an unconsumed `mockImplementationOnce` (the waiting-guard blocked its fetch) that leaked FIFO into the next test's first fetch, cascading one-test-delayed state across the file; two tests also awaited never-resolved `pendingResponse()` promises (10s hangs). Fixed by resolving before awaiting and removing the leaked stub.
- E2E `ranked-queue.spec.ts` timeout flow flaked under local multi-project parallelism: firefox/webkit instances' lone users got PAIRED by concurrently running queue tests (the queue is global shared state; all ratings 0 → oldest-joined wins). Fixed by aligning local `workers` with CI (1) in playwright.config.ts — also mitigates deferred-work.md#73 (single PHP worker starvation). Verified: 9/9 across 3 projects twice.

### Completion Notes List

- Resumed an in-progress story: backend Tasks 1-5 were complete and verified (`php artisan test` 100 passed); frontend Tasks 6-8 existed in the working tree but with failing unit tests (fixed as above — 25/25 matchmaking tests pass, full unit suite 506/506, tsc clean, story files lint-clean).
- Implemented Task 9: `tests/e2e/ranked-queue.spec.ts` — pair flow (two contexts, both banners + API-level assert that ONE pending ranked match row is visible to both players through the status endpoint), cancel flow (mutual exclusion with Test vs Bot asserted), timeout flow (true 30s server-side expiry proof). Factories + `seedAuthToken` per practice-spec conventions; engine never called (scope boundary held).
- Regression sweep found THREE pre-existing E2E failures, all verified failing on baseline a2c7727 with the 4.1 diff stashed: panel-layout 28px assertion drift (fixed: 3.9 widened the strip to 36px), two workspace duplicate-flow tests creating validator-invalid scripts (fixed with the factory's `withUpdate()`), and four Monaco behavior tests left failing (out of scope — documented in deferred-work.md for an Epic 2 debugging pass).
- Config change: playwright.config.ts `workers` now 1 locally (was `undefined`) to match CI — the queue's global state makes concurrent queue tests pair each other's users; no parallelism was raised (constraint respected).
- Test counts at completion: backend 100/100, unit 506/506, e2e — ranked-queue 9/9, practice 24/24, auth+intellisense+panel 60/60, tactic-tabs 15/15, workspace 51/55 (4 pre-existing failures documented in deferred-work.md).

### File List

- lachatadede-api/database/migrations/2026_09_17_000000_create_matchmaking_queue_table.php (new)
- lachatadede-api/app/Models/MatchmakingQueue.php (new)
- lachatadede-api/app/Services/MatchmakingService.php (new)
- lachatadede-api/app/Http/Controllers/MatchmakingController.php (new)
- lachatadede-api/app/Http/Serializers/MatchSerializer.php (new)
- lachatadede-api/app/Http/Controllers/MatchController.php (modified)
- lachatadede-api/routes/api.php (modified)
- lachatadede-api/tests/Feature/Matchmaking/MatchmakingTest.php (new)
- src/types/shared.ts (modified)
- src/stores/matchmakingStore.ts (new)
- src/stores/index.ts (modified)
- src/stores/authStore.ts (modified)
- src/components/layout/QueueStatusBanner.tsx (new)
- src/components/layout/AppShell.tsx (modified)
- src/components/layout/Header.tsx (modified)
- tests/unit/stores/matchmaking-store.test.ts (new)
- tests/unit/components/queue-status-banner.test.tsx (new)
- tests/e2e/ranked-queue.spec.ts (new)
- playwright.config.ts (modified)
- tests/e2e/panel-layout.spec.ts (modified — pre-existing 36px assertion drift fixed)
- tests/e2e/workspace.spec.ts (modified — pre-existing validator-invalid fixtures fixed)

## Change Log

- 2026-09-17: Story 4.1 implemented end to end (Tasks 1-9). Backend: matchmaking_queue table, MatchmakingService (transactional pairing, 30s expiry, idempotent join/cancel), MatchmakingController + routes, MatchSerializer extraction from MatchController, feature tests. Frontend: matchmakingStore (sequence-token polling, 401 logout, authStore reset wiring), QueueStatusBanner, Header "Queue Ranked" button + AppShell wiring with practice/queue mutual exclusion, unit tests. E2E: ranked-queue.spec.ts (pair/cancel/timeout), playwright.config.ts workers aligned with CI. Test-hygiene repairs for three pre-existing failures (panel-layout 36px, workspace withUpdate ×2); four remaining pre-existing workspace failures documented in deferred-work.md.
- 2026-09-17: Code review (3-layer adversarial: blind + edge-case + acceptance). 3 decision_needed, 12 patch, 1 defer, 7 dismissed. Decisions (Pelo, 2026-09-18): queueActive extended to 'matched' (→ patch), throttle added to queue endpoints (→ patch), 422-for-unknown-tactic kept with spec-text deviation recorded. 14 patch items total.
- 2026-09-18: All 14 review patches applied and verified (backend 101/101, unit 514/514, tsc clean, eslint clean, pint pass, e2e ranked-queue chromium 3/3). Story done.

### Review Findings

- [x] [Review][Patch] Mutual exclusion drops at 'matched' — extend queueActive to include it [src/components/layout/AppShell.tsx:112] — `queueActive = waiting || joining`, so the moment the "Match found!" banner appears both "Test vs Bot" and "Queue Ranked" re-enable while the user still holds a `pending` ranked match row — "one active match flow at a time" (Task 7) is violated: the user can start a practice sim against a pending ranked slot. **Decision (Pelo, 2026-09-18): extend `queueActive` to include 'matched' — buttons stay locked until 4.2's pending-match UI lands.**
- [x] [Review][Patch] Add rate limiting to the queue endpoints [lachatadede-api/routes/api.php] — `GET /api/matchmaking/queue` opens a `lockForUpdate` transaction on every call and the UI fires it every 2s per queued user; nothing throttles it, and the dev stack is a single PHP worker. **Decision (Pelo, 2026-09-18): add throttle now** — e.g. `throttle:60,1` on GET, tighter on POST.
- [x] [Review][Decision] Unknown `tactic_id` returns 422, spec Task 4 says 404 — `'exists:tactics,id'` validation gives Laravel's 422 for a non-existent tactic (lachatadede-api/app/Http/Controllers/MatchmakingController.php:22); only a foreign-but-existing tactic 404s (:29). **Decision (Pelo, 2026-09-18): keep 422 — consistency with the MatchController pattern MatchTest locks wins; deviation from spec Task 4's "(404)" wording recorded here. No code change.**
- [x] [Review][Patch] Concurrent joins can deadlock — only UniqueConstraintViolationException is handled [lachatadede-api/app/Services/MatchmakingService.php:36-43] — `joinOnce` locks the caller's own row (:51) then `tryPairing` locks opposing waiting rows in `joined_at` order (:135-140): two simultaneous joiners take the same two row locks in opposite order (ABBA). The only catch is the unique-violation retry; a deadlock rolls one transaction back → that user's POST 500s and zero matches are created, violating the non-negotiable "Two simultaneous joins must produce exactly one match, never two" (Dev Notes). Fix: catch the deadlock (MySQL 1213) and retry like the unique-violation path. Related: `lineupComplete()` runs a `Tactic::with('players.script')->find()` per candidate inside the locked transaction (:144-146), stretching lock-hold time with queue depth and widening exactly this deadlock window — eager-load candidate tactics in the candidates query instead.
- [x] [Review][Patch] cancelQueue: optimistic idle inverts the spec'd order and races the in-flight join [src/stores/matchmakingStore.ts:168-187] — spec Task 6 says "DELETE then idle"; the code sets `idle` (:176) BEFORE firing the DELETE (:179) and swallows non-401 failures (:185-187). Three failure modes: (1) cancel during an in-flight join POST → the DELETE lands first, then the POST creates/reactivates a `waiting` row (the `queueStatus !== 'joining'` guard at :102 drops the response, but the server row lives up to 30s and can be PAIRED while the UI shows idle); (2) a lost DELETE leaves the same invisible pairable row — the docblock's "cannot strand the row" reasoning covers expiry but not the 30s pairing window; (3) the unit test (tests/unit/stores/matchmaking-store.test.ts:255 "goes idle immediately and fires the DELETE") cements the inverted order. Fix: await the DELETE before going idle, supersede/await the in-flight join first, and on DELETE failure revert to `waiting` + resume polling.
- [x] [Review][Patch] join 401 clobbers the logout reset with a stale error [src/stores/matchmakingStore.ts:114-120] — `handleDeadSession()` → `logout()` → `matchmakingStore.reset()` (idle), then :118 unconditionally `set({ queueStatus: 'error' })`. The module-level store survives logout, so the next login on the same tab starts with a phantom "Could not join the queue" banner. The poll path (:159-160) already returns silently — match it. Also fix the unit test asserting `error` post-logout (tests/unit/stores/matchmaking-store.test.ts:155-163), which codifies the bug.
- [x] [Review][Patch] A 'matched' row can be re-queued → multiple pending ranked matches [lachatadede-api/app/Services/MatchmakingService.php:53-65] — the upsert reactivates ANY existing row unconditionally (status→waiting, match_id→null), so a user whose match-found banner was dismissed can join again and be paired a second time while the first `pending` match still exists — nothing server-side enforces one active match, corrupting 4.2's simulation/rating pipeline. Fix: if the existing row is 'matched' with a match_id, return the current matched state instead of overwriting (spec: "idempotent re-join returns current state").
- [x] [Review][Patch] join has no sequence token — stale join response overwrites a newer join [src/stores/matchmakingStore.ts:90-110] — the guard is a phase check (`queueStatus !== 'joining'`), not a token: join1 cancelled mid-flight, join2 starts, join1's late response arrives during join2's 'joining' phase and passes the check → writes join1's outcome; join2's own (matched) response then fails the phase check and is dropped. Spec Dev Notes: "Zustand actions never call `set` after an awaited response without a sequence-token guard". Fix: reuse the pollSeq token for join responses.
- [x] [Review][Patch] No reconciliation on mount — reload while queued silently abandons the wait [src/components/layout/AppShell.tsx:457-466] — `queueStatus` is memory-only; the polling effect is keyed on `queueStatus === 'waiting'`, so after a page refresh there is no banner and no polling while the server-side row keeps waiting and can be paired without the user ever seeing "Match found!". Fix: one reconciling status check on mount that re-enters the matching phase (note: `pollStatus()`'s own `!== 'waiting'` guard needs an entry path for this).
- [x] [Review][Patch] Candidate tactic deleted mid-transaction → FK failure or gutted match [lachatadede-api/app/Services/MatchmakingService.php:144-175] — candidate queue rows are locked but their `tactic` rows are not: a concurrent tactic delete between `lineupComplete()` (:145) and `GameMatch::create` (:167) either fails the insert on the tactic FK (500) or cascades `nullOnDelete` into a created match with null tactics. The joiner's own tactic (validated at join time only, Dev Notes) has the same window. Fix: lock the tactic rows (`lockForUpdate`) for both sides inside the transaction before creating the match.
- [x] [Review][Patch] Pairing query has no index for its filter/sort [lachatadede-api/database/migrations/2026_09_17_000000_create_matchmaking_queue_table.php:33-35] — `WHERE status='waiting' AND joined_at >= cutoff ORDER BY joined_at` only has the unique `user_id` index available, and rows are never deleted (audit by design) — every join full-scans the whole history inside the lock-taking transaction. Fix: `$table->index(['status', 'joined_at'])`.
- [x] [Review][Patch] Lineup rule implemented twice — controller inline vs service private [lachatadede-api/app/Http/Controllers/MatchmakingController.php:33-38, lachatadede-api/app/Services/MatchmakingService.php:186-193] — the 5-slots×script check is copy-pasted; when 4.2 touches slot rules in one place only, the controller accepts lineups pairing will silently skip → the user waits 30s for a guaranteed timeout. Fix: make `MatchmakingService::lineupComplete()` public and call it from the controller.
- [x] [Review][Patch] `matched` payload without `match` falls through every poll branch [src/stores/matchmakingStore.ts:144-153] — if the API ever reports `matched` without a `match` object (contract drift), the poll matches no branch and the client stays "Searching..." until a false timeout; the join path maps it to a generic error. Fix: treat matched-without-match defensively (map to error/timeout) in both paths.
- [x] [Review][Patch] Error banner missing `role="status"` — screen readers silent on failures [src/components/layout/QueueStatusBanner.tsx:69-75] — the searching/matched/timeout banners all carry `role="status"` (:38,:49,:60); the error banner is a bare div, inconsistent with its siblings and the `role="alert"` precedent (AppShell replay error banner). Fix: add `role="status"` (or `role="alert"`).
- [x] [Review][Patch] API status type named `QueueApiStatus`, spec Task 6 says `MatchmakingStatus`/`UnionMatchmakingStatus` [src/types/shared.ts:205] — the union values and payload shape match the spec; only the name deviates. Rename for spec traceability or record the deviation.
- [x] [Review][Defer] `MatchSerializer::toArray($match->fresh())` accepts a nullable that TypeError's [lachatadede-api/app/Http/Controllers/MatchController.php:96] — deferred, pre-existing: the null-fresh risk predates 4.1 (the extraction moved `serializeMatch($match->fresh())` behavior-identically) and matches are never deleted in-app, so `fresh()` after a same-request create cannot realistically be null.
- [ ] [Review][Dismissed] (7 findings — logged for traceability) whole-store Zustand subscription in AppShell (matches the existing `useMatchStore()` precedent; the store only `set`s on phase transitions, not per poll) · overlapping 2s polls when a request exceeds 2s (seq token already keeps state correct; pile-up is self-limiting) · serial e2e aborts remaining tests on failure (spec-mandated pattern from practice-match.spec.ts) · 30s e2e wait cost (spec explicitly: "keep it despite the wait") · panel-layout 28→36px "rubber-stamp" suspicion (auditor verified the strip IS 36px in AppShell.tsx:786 — a real story-3.9 change documented in deferred-work.md) · `handleDeadSession` not awaiting `logout()` (false positive — logout is sync, src/stores/authStore.ts:34,116) · polls failing forever keep "Searching..." (documented deliberate trade-off in the store docblock; server-side expiry bounds the state).
