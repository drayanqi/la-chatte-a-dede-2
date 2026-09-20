---
baseline_commit: a3d02b04faed3634cadaee5a4077d8180090adb2
---

# Story 4.1: Ready Tactics & Queue Removal

Status: done

## Story

As a user,
I want to mark any of my tactics as ready to play,
So that they can be challenged by other players while I am offline.

## Acceptance Criteria

1. **Given** I have a tactic with a complete lineup (5 slots, all scripted), **When** I toggle "ready" on its tab, **Then** the tactic is marked ready and persists, **And** the tab shows its elo and win/loss record.

2. **Given** I have several tactics, **When** I mark more than one ready, **Then** all of them are independently challengeable.

3. **Given** a tactic whose lineup is incomplete, **When** I try to mark it ready, **Then** the request is refused with 422 "Tactic lineup is incomplete".

4. **Given** the ranked queue shipped by the superseded story 4.1, **When** this story lands, **Then** the queue backend, UI and `matchmaking_queue` table are removed, **And** the tactics API exposes `isReady`, `elo`, `wins` and `losses`.

## Scope Boundary (read first)

- **No ranked matches are played in this story.** The ready flag, elo (default 1000) and W/L counters exist and display, but nothing moves them yet — the ranked engine is story 4.2, the matchmaking view is 4.3.
- **elo / wins / losses are server-managed.** The client can only set `is_ready`; the other columns are never accepted from user input.
- **No new npm/composer dependencies.**
- The Header loses the "Queue Ranked" button entirely; the "Ranked" navigation entry arrives with story 4.3's view.

## Tasks / Subtasks

### Backend Tasks (Laravel — `lachatadede-api/`)

- [x] Task 1: Migration `2026_09_19_000000_ready_tactics_drop_queue.php` (AC: #1, #4)
  - [x] `tactics`: `is_ready` boolean default false, `elo` unsignedInteger default 1000, `wins`/`losses` unsignedInteger default 0, composite index `(is_ready, elo)`
  - [x] Drop `matchmaking_queue`
  - [x] `matches.points_challenger` / `points_opponent`: unsignedInteger → signed integer (nullable unchanged) — elo deltas go negative
- [x] Task 2: `Tactic` model — fillable `is_ready`, `elo`, `wins`, `losses`; casts (`is_ready` boolean, counters integer); `lineupIsComplete(): bool` helper (5 slots, every `script` non-null) extracted for reuse by 4.2
- [x] Task 3: `TacticController` (AC: #1, #3, #4)
  - [x] Validation: `is_ready` nullable boolean on store/update
  - [x] Store: create with `is_ready` (default false); gate `is_ready = true` on the payload's lineup completeness (5 slots with script ids) → 422 `Tactic lineup is incomplete`
  - [x] Update: explicit `is_ready` key updates the flag (null → false); gating re-validates against the resulting lineup (replaced players when `players` is sent, existing loaded players otherwise)
  - [x] `serializeTactic` adds `isReady`, `elo`, `wins`, `losses`
- [x] Task 4: Rip out the queue (AC: #4)
  - [x] Delete `app/Services/MatchmakingService.php`, `app/Http/Controllers/MatchmakingController.php`, `app/Models/MatchmakingQueue.php`, `tests/Feature/Matchmaking/`
  - [x] `routes/api.php`: remove the matchmaking route group
  - [x] `AppServiceProvider`: keep the `matchmaking` limiter (story 4.2 reuses it), refresh its comment
- [x] Task 5: Feature tests — extend `TacticTest`
  - [x] Responses expose `isReady`/`elo`/`wins`/`losses` (index, show, store, update)
  - [x] Ready requires a complete lineup: 422 on incomplete (store and update paths); update against the post-replacement lineup
  - [x] Ready toggles off freely (flag → false never gated)
  - [x] `users.points`-style elo/counter columns are never writable through the API (assert elo unchanged after attempts)

### Frontend Tasks (React — `src/`)

- [x] Task 6: Types (`src/types/shared.ts`) — `TacticConfig` gains `isReady`, `elo`, `wins`, `losses`; delete `MatchmakingStatus`/`QueueStatusResponse`
- [x] Task 7: Rip out the queue UI (AC: #4)
  - [x] Delete `src/stores/matchmakingStore.ts`, `src/components/layout/QueueStatusBanner.tsx`, `tests/unit/stores/matchmaking-store.test.ts`, `tests/e2e/ranked-queue.spec.ts`
  - [x] `stores/index.ts` / `authStore.ts`: drop the matchmaking store export + reset wiring
  - [x] `AppShell.tsx`: remove queue state, `handleStartQueue`, the 2s poll effect, the mount reconcile effect, the banner
  - [x] `Header.tsx`: remove `queueActive`/`onStartQueue` and the "Queue Ranked" button
- [x] Task 8: `tacticsStore.toggleReady` (AC: #1)
  - [x] Extend `updateTactic`/pending queue with an optional `isReady` field (same in-flight guard and latest-wins merge as name/slots) → PUT `{is_ready}` only
  - [x] Response tactic replaces the cached one (elo/W-L come back in the body)
- [x] Task 9: `TabBar` ready toggle + record (AC: #1, #2)
  - [x] Per-tab ready pill toggle (`data-testid="ready-toggle"`, `data-tactic-id`, `aria-pressed`), green when ready, gated client-side on the tab's lineup completeness
  - [x] Active tab shows `elo · W-L` (compact record text)
  - [x] Toggle failure surfaces the store error (existing error chip)

## Verification

- `php artisan test` green (TacticTest extended, Matchmaking tests deleted)
- `npm run lint`, `npx tsc -b`, `npm run test:unit` green
- `migrate:fresh` then manual smoke: toggle ready on a tab, reload, state persists

## Dev Agent Record

**Completed 2026-09-19.** All acceptance criteria verified.

### Approach notes

- Migration chain: the old `create_matchmaking_queue` migration is kept so fresh databases replay create → drop; only the new migration removes the table and adds the tactics columns. `matches.points_*` flipped to signed in the same migration (elo deltas go negative).
- `Tactic::lineupIsComplete()` counts 5 players with non-null `script` — shared by the controller gating and the 4.2 pool filter.
- Store path: `isReady` rides the existing latest-wins `pendingUpdate` merge (same as rename), so a ready toggle clicked while a lineup save is in flight is never dropped — PUT `{is_ready: true}` fires after the slots PUT settles.
- TabBar: ready pill is disabled (not hidden) when the lineup is incomplete; record text `elo · W-L` renders only on ready tactics; tab maxWidth 180 → 200 to fit the record.

### Completion notes / deviations

- Serialization uses the established `snake_case → camelCase` mapping in `TacticController` (`is_ready → isReady`, etc.); no serializer class added (matches existing tactic serialization style).
- `updateTactic` PUT sends only changed fields (`is_ready` alone when toggling) — verified by unit test asserting the exact body.
- The old story file `4-1-ranked-queue-and-matchmaking.md` is retained but marked **SUPERSEDED** (points to this story).

### Verification results

- Backend: `php artisan migrate:fresh --env=testing --force` + `php artisan test --env=testing` → **104 passed, 1 failed**. The failure is the pre-existing `Tests\Feature\ExampleTest` (GET `/` → "no such table: sessions" in :memory: sqlite; fails identically on baseline commit — unrelated to this story). TacticTest: +6 tests green. Old `tests/Feature/Matchmaking/` deleted with the queue.
- Frontend: `rtk tsc -b` clean; `eslint src tests` 0 errors (4 pre-existing warnings); `rtk vitest run` **500 passed** (at story completion; +1 queued-ready-toggle merge test added during epic close-out → 501). Deleted: `matchmaking-store.test.ts`, `queue-status-banner.test.tsx`, `ranked-queue.spec.ts`. New: 4 ready-toggle tests in `tab-bar.test.tsx` (18 total in file), 1 queued-merge test in `tactics-store.test.ts`.
- Manual smoke replaced by automated coverage: toggle persistence is covered end-to-end by feature tests (PUT `is_ready` → persisted → serialized back) and TabBar unit tests; no manual browser pass performed.
