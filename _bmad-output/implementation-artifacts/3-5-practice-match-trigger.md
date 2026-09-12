# Story 3.5: Practice Match Trigger

Status: ready-for-dev

## Story

As a user,
I want to instantly start a practice match against a bot,
So that I can test my AI without waiting.

## Acceptance Criteria

1. **Given** I have a valid lineup configured, **When** I click "Test vs Bot", **Then** the match starts simulating immediately, **And** I see a loading state "Simulating...", **And** simulation completes in < 2 seconds for reasonable scripts (NFR2; hard cap 30s enforced by engine).

2. **Given** simulation completes, **When** results are ready, **Then** I see the final score, **And** the "Watch Replay" button appears (replay loading itself is Story 3.8).

3. **Given** I don't need to wait for other players, **When** I start practice, **Then** there is zero queue time (synchronous request, no polling).

4. **Given** the engine fails or times out, **When** the match cannot complete, **Then** I see an error message and can retry, and no broken match row is presented as watchable.

## Tasks / Subtasks

### Backend Tasks (Laravel)

- [ ] Task 1: `matches` table migration (variance from database-schema.md documented in Dev Notes)
  - [ ] Columns: uuid PK, nullable `challenger_id` FK users, nullable `opponent_id` FK users, nullable `challenger_tactic` FK tactics, nullable `opponent_tactic` FK tactics, `mode` ENUM('practice','ranked') default 'practice', `seed` int, nullable `bot_tactic` FK tactics (system tactic for practice), `score_challenger` int default 0, `score_opponent` int default 0, nullable `result` ENUM('challenger_win','opponent_win','draw'), nullable `points_challenger` int, nullable `points_opponent` int, `duration_frames` int default 0, `status` ENUM('pending','completed','failed') default 'pending', nullable `frames_file` string, timestamps
- [ ] Task 2: `GameEngineService` (`app/Services/GameEngineService.php`)
  - [ ] `simulate(Match $match, Tactic $userTactic, Tactic $botTactic): array` — builds `/simulate` payload (3.3 contract): match_id, random int seed, output_path = `storage_path('simulations')`, both teams' players `{slot, x, y, script: script code string}` (load code via script relation; bot scripts come from the system tactic)
  - [ ] `Http::timeout(35)->post(rtrim(env('GAME_ENGINE_URL'), '/').'/simulate', $payload)`; on success: response passes through; on connection error/timeout/`success:false` → throw `GameEngineException`
  - [ ] env fallback for local dev: `GAME_ENGINE_URL=http://127.0.0.1:3001` in `.env.example`
- [ ] Task 3: `MatchController` (AC: #1, #3, #4)
  - [ ] `POST /api/matches` body `{mode: 'practice', tactic_id, bot: 'easy'}` → create Match(status pending, seed random) → call GameEngineService → on success update match (scores, result, duration_frames, status completed, frames_file) → return 201 match JSON; on GameEngineException → mark status failed, return 502 `{message: 'Simulation failed'}` (AC: #4)
  - [ ] `GET /api/matches` — user's matches, newest first, paginated (limit 20) — supports "most recent match" (FR34)
  - [ ] `GET /api/matches/{id}` — user-scoped (challenger_id = user for practice)
  - [ ] `GET /api/matches/{id}/frames` — user-scoped; read + stream `storage/simulations/{match_id}.json` (return file response; 404 if file missing); needed by 3.8
  - [ ] Points columns stay null for practice (no rating changes until Epic 4)
- [ ] Task 4: Feature tests `tests/Feature/Matches/MatchTest.php`
  - [ ] Http::fake engine: success path persists scores/result/frames_file + 201; engine 500/timeout → match status failed + 502; unauthenticated 401; other user's match 404; frames endpoint returns file content
  - [ ] Seed route model: bot tactic must resolve to the seeded system tactic (3.6 seeds it — for THIS story's tests, create system tactic in test setup)

### Frontend Tasks (React)

- [ ] Task 5: `src/stores/matchStore.ts`
  - [ ] State: `isSimulating`, `lastMatch: MatchResult | null`, `matchError`, actions `startPracticeMatch(tacticId)` → POST /api/matches via `apiClient` (3.1), sets result/error; `reset()`
  - [ ] Type `MatchResult` in `src/types/shared.ts`: `{id, mode, scoreChallenger, scoreOpponent, result, durationFrames, status, createdAt}`
- [ ] Task 6: Wire "Test vs Bot" flow (AC: #1, #2, #3)
  - [ ] AppShell replaces 3.2's placeholder handler: LineupDialog "Start Match" → `startPracticeMatch(activeTacticId)`; while `isSimulating` show overlay `data-testid="simulating-overlay"` with text "Simulating..."
  - [ ] On success: close overlay, show result banner `data-testid="match-result-banner"` with final score (e.g. "You 2 — 1 Easy Bot") and button `data-testid="watch-replay-button"` (visible; frame loading wired in 3.8)
  - [ ] On error: `data-testid="match-error-message"` with retry button; overlay dismissed
- [ ] Task 7: Unit tests matchStore (mock apiClient): loading flags, success/error paths; component test for overlay/banner states

### Testing Tasks (E2E)

- [ ] Task 8: Re-enable `tests/e2e/practice-match.spec.ts` (currently fully commented out)
  - [ ] Playwright config gains a third webServer: engine (`cd lachatadede-engine && npm run dev`, port 3001, url `http://127.0.0.1:3001/health`) — keep `reuseExistingServer`
  - [ ] Tests: full loop register → assign StarterAI to 5 slots → Test vs Bot → Simulating overlay appears → result banner with score → watch-replay button present (AC: #1, #2)
  - [ ] MatchFactory in `tests/support/factories/match-factory.ts` now works against real endpoints — align its payloads with the final API

## Dev Notes

- **Schema variance (deliberate):** database-schema.md's `match` table is multiplayer-only (both users + tactics NOT NULL). Practice mode needs nullable opponent sides + `mode`/`status`/`frames_file` columns. Epic 4 reuses the same table with mode='ranked'. Document this in the migration docblock.
- **Synchronous flow** (backend-architecture.md): React → Laravel POST /api/matches → Laravel → Node POST /simulate → Laravel updates row → responds. No queue, no polling (FR21 zero wait). PHP max_execution_time must exceed 35s HTTP timeout for CLI-server dev (`php artisan serve` is fine; note for prod php-fpm `request_terminate_timeout`).
- **Seed:** random int (e.g. `random_int(1, 2**31-1)`) stored on the match — replays and determinism tests depend on it.
- **output_path:** engine writes where Laravel says (payload `output_path`) — docker mounts `./storage` into both containers (`/var/www/storage` Laravel, `/app/storage` node per existing compose volumes); local dev uses `storage_path('simulations')` which is inside the Laravel repo dir.
- The Easy bot tactic (3.6) doesn't exist yet at runtime — until 3.6 lands, MatchController's bot resolution can create/find the system tactic in a seeder stub (simple seeder with placeholder no-op scripts is acceptable and replaced by 3.6).
- Simulating overlay: block double-start (disable button while isSimulating); Escape must NOT cancel a running simulation (server-side work continues; UI waits).
- Architecture compliance: English-only code/comments; apiClient for all HTTP; inline styles; data-testid everywhere.

### Test Selectors

| Selector | Element |
|----------|---------|
| `[data-testid="simulating-overlay"]` | "Simulating..." loading overlay |
| `[data-testid="match-result-banner"]` | Final score + Watch Replay |
| `[data-testid="watch-replay-button"]` | Watch Replay button |
| `[data-testid="match-error-message"]` | Failure message |
| `[data-testid="retry-match-button"]` | Retry after failure |

### Previous Story Intelligence

- From 3.2: LineupDialog already calls `onStartPractice(tacticConfig)` — AppShell is the wiring point; keep dialog responsible only for lineup validity.
- From 3.3/3.4: engine contract is `{success, file, result}`; frame files land in `output_path`; GAME_ENGINE_URL env name fixed.
- From deferred-work.md: loading spinners anti-pattern — "Simulating..." overlay is REQUIRED UX (user needs feedback) but keep it minimal, no animated spinner (UX spec anti-pattern: loading spinners kill iteration speed feel).
- Monaco bundle deferred item is unrelated — do not bundle-split here.

### Project Structure Notes

- New: `lachatadede-api/app/Services/GameEngineService.php`, `app/Http/Controllers/MatchController.php`, 1 migration, `tests/Feature/Matches/MatchTest.php`
- New: `src/stores/matchStore.ts`, update `src/types/shared.ts`, barrels
- Update: `src/components/layout/{AppShell,Header}.tsx`, `playwright.config.ts`, `tests/support/factories/match-factory.ts`, `tests/e2e/practice-match.spec.ts`
- Update: `lachatadede-api/routes/api.php` (match routes), `.env.example` (GAME_ENGINE_URL)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5: Practice Match Trigger]
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Flux de Simulation]
- [Source: _bmad-output/planning-artifacts/database-schema.md#MATCH]
- [Source: deploy/docker-compose.yml] (shared storage volume + GAME_ENGINE_URL)
- [Source: tests/e2e/practice-match.spec.ts] (commented-out spec to revive)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
