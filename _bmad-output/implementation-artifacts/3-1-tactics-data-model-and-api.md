---
baseline_commit: 4e6e70d72990beffe19d91b8419f6f361fdb05ce
---

# Story 3.1: Tactics Data Model & API

Status: done

## Story

As a user,
I want my team lineup to be saved,
So that I don't have to reconfigure it every match.

## Acceptance Criteria

1. **Given** I am authenticated, **When** I access the tactics API, **Then** I can create, read, update, and delete tactics configurations.

2. **Given** I create a tactic, **When** I assign scripts to the 5 positions, **Then** the configuration is persisted with: position 1-5 slot assignments, script ID for each slot, and starting positions (x, y) for each slot.

3. **Given** I request a tactic, **When** the response returns, **Then** each player slot includes its assigned script id (not the script code — code stays private to its owner).

4. **Given** I try to access another user's tactic, **When** I request it by id, **Then** I receive a 404 (tactics are private to their owner in MVP).

## Tasks / Subtasks

### Backend Tasks (Laravel)

- [x] Task 1: Create migrations (AC: #2)
  - [x] `tactics`: uuid PK, nullable `user_id` FK → users (cascade), `name` varchar(100), `is_public` bool default false, `is_system` bool default false, timestamps
  - [x] `tactic_player`: uuid PK, `tactic_id` FK → tactics (cascade), `player_slot` int 1-5, `position_x` float 0-100, `position_y` float 0-50, nullable `script_id` FK → scripts (SET NULL), UNIQUE(tactic_id, player_slot)
  - [x] Index on `tactic_player(tactic_id)` and `tactics(user_id)`
- [x] Task 2: Create models (AC: #2, #3)
  - [x] `Tactic`: HasUuids, fillable, `user(): BelongsTo`, `players(): HasMany(TacticPlayer)`, `user()` relation on User model (`tactics(): HasMany`)
  - [x] `TacticPlayer`: HasUuids, fillable, `tactic(): BelongsTo`, `script(): BelongsTo`
- [x] Task 3: Create TacticController with CRUD (AC: #1, #3, #4)
  - [x] `index` — list auth user's tactics with players eager-loaded
  - [x] `store` — validate: name required max 100; `players` array of max 5 items `{player_slot: 1-5, position_x: 0-100, position_y: 0-50, script_id: nullable uuid exists:scripts,id}`; verify script_ids belong to the user; create tactic + players in a transaction; return 201 with tactic
  - [x] `show` — user-scoped find with players; 404 otherwise (AC: #4)
  - [x] `update` — user-scoped; replace name and/or full players array in a transaction
  - [x] `destroy` — user-scoped; delete (cascade removes players)
  - [x] Follow ScriptController.php patterns exactly: `Auth::user()->tactics()` scoping, JsonResponse shapes, 404 message `'Tactic not found'`
- [x] Task 4: Register routes in `routes/api.php` (AC: #1)
  - [x] Inside `auth:sanctum` group: GET/POST `/tactics`, GET/PUT/DELETE `/tactics/{id}`
- [x] Task 5: Feature tests `tests/Feature/Tactics/TacticTest.php` (AC: #1-#4)
  - [x] Mirror `tests/Feature/Scripts/ScriptTest.php` structure: authenticated CRUD happy paths, validation errors (slot out of range, position out of bounds, >5 players, foreign script_id), 404 on other user's tactic, unauthenticated 401

### Frontend Tasks (React)

- [x] Task 6: Create shared `apiClient` (deferred-work.md item — do it here, all Epic 3 stories consume it)
  - [x] `src/lib/apiClient.ts`: `apiFetch(path, options)` wrapping fetch with `API_URL` (`import.meta.env.VITE_API_URL || '/api'`), `Authorization: Bearer` from `localStorage.auth_token`, `Accept: application/json`, `credentials: 'include'`; throws typed error `{status, message}` on !ok; export `getApiError(e)` helper
  - [x] Refactor `authStore.ts` and `editorStore.ts` fetch calls to use it — behavior must be identical (all existing unit tests must pass unchanged)
- [x] Task 7: Create `src/stores/tacticsStore.ts` (AC: #1, #2)
  - [x] State: `tactics: TacticConfig[]`, `activeTacticId: string | null`, `isLoadingTactics`, `isSavingTactic`, `tacticsError`
  - [x] Actions: `fetchTactics()`, `saveTactic(name, slots)` (POST, sets activeTacticId on create), `updateTactic(id, name?, slots?)` (PUT), `selectTactic(id)`, `reset()`
  - [x] Type `TacticConfig` in `src/types/shared.ts`: `{id, name, isSystem, players: TacticPlayerConfig[]}` where `TacticPlayerConfig = {playerSlot: 1|2|3|4|5, positionX, positionY, scriptId: string | null}`
- [x] Task 8: Unit tests for tacticsStore and apiClient (AC: #1, #2)
  - [x] `tests/unit/stores/tactics-store.test.ts` mirroring `editor-store.test.ts` patterns (mock fetch)
  - [x] `tests/unit/lib/api-client.test.ts`: header injection, error throw shape, 401 passthrough

## Dev Notes

- **Table names are English** (`tactics`, `tactic_player`), NOT `tactique`/`tactique_joueur` from database-schema.md — the codebase convention is English (`users`, `scripts`); consistency wins. Variance documented here deliberately.
- Scripts are assigned by reference (`script_id` FK, `ON DELETE SET NULL`): deleting a script (Story 2.8) leaves the slot empty — lineup UI (3.2) must handle null scriptId as "unassigned". No script code ever leaves the API tied to a tactic (NFR9: code privacy).
- `is_system`/`user_id` nullable exist for the Easy Bot system tactic (Story 3.6 seeds `is_system=true, user_id=null`) — do not enforce `user_id` NOT NULL.
- `apiClient` refactor (Task 6) is scoped EXACTLY to: extract duplicated fetch plumbing. Do NOT redesign store APIs or response handling. The 5 existing call sites: authStore (register, login, logout, user, restoreSession), editorStore (scripts CRUD). All existing tests must stay green.
- API response shape for a tactic (use this exact shape so 3.2/3.5 can rely on it):
  ```json
  { "id": "uuid", "name": "My Tactic", "isSystem": false,
    "players": [ { "playerSlot": 1, "positionX": 8.0, "positionY": 25.0, "scriptId": "uuid|null" } ] }
  ```
  Serialize with explicit arrays (snake_case → camelCase mapping in the controller/resource), matching the camelCase style used by AuthController/ScriptController responses.
- Laravel HTTP client, PHPUnit feature tests, SQLite in dev. No `is_valid` handling here (that's Story 3.4).
- Architecture compliance: ALL code, comments, variable names in English (established rule from Stories 2.x).

### Test Selectors

No UI in this story. Frontend store tests follow existing mocking patterns in `tests/unit/stores/editor-store.test.ts`.

### Previous Story Intelligence

- From 2.8: `deleteScript` leaves dangling references nowhere today — after this story, script deletion can orphan `tactic_player.script_id` (handled by FK SET NULL; mention in 3.2's notes so lineup shows "unassigned").
- From deferred-work.md: "Shared API client — fetch plumbing duplicated across 5 call sites… Introduce apiClient" — Task 6 pays this debt. Do it in this story because every subsequent Epic 3 story adds call sites.
- Git: last commits are epic-1/2 auth + API features; `dfb033f implement all API features` touched ScriptController — copy its validation/scoping style.

### Project Structure Notes

- Update: `lachatadede-api/routes/api.php`, `lachatadede-api/app/Models/User.php`
- New: `lachatadede-api/app/Models/{Tactic,TacticPlayer}.php`, `app/Http/Controllers/TacticController.php`, 1 migration file (both tables in one migration is fine), `tests/Feature/Tactics/TacticTest.php`
- New: `src/lib/apiClient.ts`, `src/stores/tacticsStore.ts`, update `src/types/shared.ts`, both store barrels (`src/stores/index.ts`, `src/lib/index.ts`)
- `tests/support/factories/match-factory.ts` already declares a `createTactic` API helper expecting these endpoints — align its paths/payload with the final contract and leave it usable (it is currently dead code because endpoints did not exist).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: Tactics Data Model & API]
- [Source: _bmad-output/planning-artifacts/database-schema.md#TACTIQUE / TACTIQUE_JOUEUR]
- [Source: _bmad-output/planning-artifacts/backend-architecture.md#Endoints API (Tactiques)]
- [Source: lachatadede-api/app/Http/Controllers/ScriptController.php] (scoping/validation pattern)
- [Source: lachatadede-api/tests/Feature/Scripts/ScriptTest.php] (feature test pattern)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Shared API client]

## Dev Agent Record

### Agent Model Used

euria-code (infomaniak/euria-code), opencode dev agent — Story 3.1 execution, 2026-09-12

### Debug Log References

- RED→GREEN cycles executed per task group; failing tests confirmed before each implementation:
  - Model/persistence tests failed with `Class "App\Models\Tactic" not found` before migration/models existed
  - CRUD tests failed 19× (404 missing routes) before controller+routes were added
  - `api-client.test.ts` failed on missing module `@/lib/apiClient` before client implementation
  - `tactics-store.test.ts` failed on missing module `@/stores/tacticsStore` before store implementation
- Fixed during implementation:
  - `TacticPlayer` needed explicit `$table = 'tactic_player'` (Laravel pluralizes to `tactic_players`) and `$timestamps = false` (story spec has no timestamp columns on that table)
  - `is_system` serialized as null on freshly created rows → cast `(bool)` in serializer (DB default not loaded into model attributes)
  - `update` validation needed `name` nullable (partial payloads); explicitly-sent empty name keeps the current name instead of violating NOT NULL
  - SQLite NUMERIC affinity stores 50.0 as int; PHP serializes 50.0 as `50` in JSON — position assertions compare numerically (JSON numbers have no int/float distinction)
  - Test bug fixed: script-deletion test initially deleted an unreferenced script; now deletes one referenced script and asserts only its slot is nulled
- Node: shell default is v8; tests run with `~/.nvm/versions/node/v24.15.0/bin` on PATH

### Completion Notes List

- **Task 1** — Single migration `2026_09_12_000000_create_tactics_tables` creates `tactics` (uuid PK, nullable user_id FK cascade + index, name(100), is_public/is_system defaults, timestamps) and `tactic_player` (uuid PK, tactic_id FK cascade + index, player_slot unsignedTinyInt, position_x/y floats, nullable script_id FK SET NULL, UNIQUE(tactic_id, player_slot)). English table names per Dev Notes (deliberate variance from database-schema.md).
- **Task 2** — `Tactic` (HasUuids, fillable incl. is_public/is_system for Story 3.6 seeding, boolean casts, user()/players()) and `TacticPlayer` (HasUuids, tactic_player table, no timestamps, integer/float casts, tactic()/script()). `User::tactics()` added.
- **Task 3** — `TacticController` mirrors ScriptController patterns: `Auth::user()->tactics()` scoping, explicit-array camelCase serialization (`{id, name, isSystem, players: [{playerSlot, positionX, positionY, scriptId}]}` — script code never exposed, AC #3/NFR9), 404 `'Tactic not found'`. store/update validate name (required max:100 / nullable), players array max:5 with per-item slot 1-5 (distinct), positions 0-100/0-50, nullable uuid script_id `exists:scripts,id`; foreign script_ids rejected via ownership count check (422); tactic+players created/replaced in DB::transaction; update replaces the full players array only when the `players` key is sent. index/show eager-load players; index sorts by updated_at desc.
- **Task 4** — Routes registered in the `auth:sanctum` group: GET/POST `/tactics`, GET/PUT/DELETE `/tactics/{id}`.
- **Task 5** — 22 feature tests: 401 unauthenticated, index scoping (+ system tactic invisible), create happy path with shape/code-privacy asserts, null scriptIds, name/slot/position/>5-players/duplicate-slot/foreign+unknown script_id validation, 404 cross-user GET/PUT/DELETE, update name-only vs full-array replace, destroy cascade, script deletion leaves slot unassigned (SET NULL), user deletion cascades tactics+players.
- **Task 6** — `apiClient.ts`: `apiFetch` (base URL, bearer from localStorage, Accept, Content-Type only with body, credentials include, ApiError{status,message} on !ok with 401 passthrough — no auto-logout), `ApiError` class, `getApiError()` helper. All 5 authStore call sites (register, login, logout, user, restoreSession) and all editorStore scripts-CRUD call sites refactored; per-action fallback messages preserved; **all 229 pre-existing unit tests pass unchanged**.
- **Task 7** — `tacticsStore.ts` (state + fetchTactics/saveTactic/updateTactic/selectTactic/clearTacticsError/reset; camelCase↔snake_case mapping at the boundary). `TacticConfig`/`TacticPlayerConfig` added to `src/types/shared.ts`; stores barrel updated.
- **Task 8** — 25 tactics-store unit tests + 12 api-client unit tests (header injection, ApiError shape, 401 passthrough, non-JSON error body, getApiError). `match-factory.ts` `createTactic` aligned with the final contract: snake_case payload, in-bounds 1-2-2 formation (x 0-100, y 0-50), response typed `{id, name, isSystem, players}` — usable for Story 3.5 e2e.
- **Validation** — Backend: 49/49 tests, 200 assertions, Pint pass on all story files. Frontend: 266/266 unit tests, ESLint 0 errors (6 pre-existing warnings, none in story files), `tsc -b` clean.

### File List

- lachatadede-api/database/migrations/2026_09_12_000000_create_tactics_tables.php (new)
- lachatadede-api/app/Models/Tactic.php (new)
- lachatadede-api/app/Models/TacticPlayer.php (new)
- lachatadede-api/app/Models/User.php (modified — added tactics() relation)
- lachatadede-api/app/Http/Controllers/TacticController.php (new)
- lachatadede-api/routes/api.php (modified — tactics routes)
- lachatadede-api/tests/Feature/Tactics/TacticTest.php (new)
- src/lib/apiClient.ts (new)
- src/lib/index.ts (modified — apiClient exports)
- src/stores/tacticsStore.ts (new)
- src/stores/authStore.ts (modified — apiFetch refactor)
- src/stores/editorStore.ts (modified — apiFetch refactor)
- src/stores/index.ts (modified — tactics store export)
- src/types/shared.ts (modified — TacticConfig/TacticPlayerConfig)
- tests/unit/lib/api-client.test.ts (new)
- tests/unit/stores/tactics-store.test.ts (new)
- tests/support/fixtures/factories/match-factory.ts (modified — aligned with API contract)

## Change Log

- 2026-09-12: Story 3.1 implemented — tactics data model (tactics + tactic_player tables, models), user-scoped tactics CRUD API with script-ownership enforcement and code-privacy guarantees, shared `apiClient` extracting duplicated fetch plumbing (pays deferred-work.md "Shared API client" item), `tacticsStore` + shared types, and full test coverage (22 backend feature tests, 37 frontend unit tests). Existing auth/editor store tests green unchanged after apiClient refactor.
- 2026-09-12: Code review completed (3 layers) — 10 findings fixed (2 HIGH, 5 MEDIUM, 3 LOW), 2 deferred, 1 decision accepted. Backend 52/52, frontend 269/269, Pint/tsc/ESLint clean. Status → done.

### Review Findings

_Code review 2026-09-12 (baseline 4e6e70d, 3 review layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor)._

- [x] [Review][Patch] PUT with explicit `players: null` silently deletes the entire lineup — resolved (Pelo, 2026-09-12): treat null as "no change", consistent with `name` handling; switch `$request->has('players')` to `$request->filled('players')` [lachatadede-api/app/Http/Controllers/TacticController.php:87-102]
- [x] [Review][Decision] Non-JSON error bodies (e.g. HTML 502 from a proxy) in register/login now surface the generic "Authentication failed." message instead of the action-specific fallback — resolved (Pelo, 2026-09-12): accepted; one consistent message on an untested edge path is preferable. Record correction: Task 6's "behavior must be identical" holds for all tested paths and JSON bodies; non-JSON bodies now yield the generic auth message by design [src/lib/apiClient.ts:46, src/stores/authStore.ts:69-77,98-107]
- [x] [Review][Patch] restoreSession clears the auth token on ANY ApiError (500/502/503/429), contradicting its own transient-outage comment — guard `error.status === 401` before treating the token as definitively invalid [src/stores/authStore.ts:144-153]
- [x] [Review][Patch] Assigning the SAME owned script to 2+ slots is falsely rejected 422 "One or more scripts do not belong to you" — `foreignScriptError()` compares raw `count($scriptIds)` (duplicates preserved) against `whereIn(...)->count()` (deduped by SQL); compare against `count(array_unique($scriptIds))` [lachatadede-api/app/Http/Controllers/TacticController.php:166-178]
- [x] [Review][Patch] apiFetch throws a raw TypeError when an error body parses to JSON `null` — `data.message ?? ''` reads `.message` on null; optional chaining (`data?.message ?? ''`) preserves the ApiError contract [src/lib/apiClient.ts:46-47]
- [x] [Review][Patch] Script-deletion TOCTOU: exists/ownership checks run outside DB::transaction — a script deleted concurrently makes the player insert violate the FK and surface as an unhandled QueryException 500 instead of 422; catch QueryException around the transaction or re-validate inside it [lachatadede-api/app/Http/Controllers/TacticController.php:48-59,87-105]
- [x] [Review][Patch] Players-only PUT never touches `updated_at` (parent update() skipped when $changes is empty) but index() orders by updated_at desc — just-edited tactic keeps a stale list position; touch() the tactic when replacePlayers() runs [lachatadede-api/app/Http/Controllers/TacticController.php:96-103]
- [x] [Review][Patch] No in-flight guard on saveTactic/updateTactic — double-click creates duplicate tactics (both POSTs succeed) and flip-flops activeTacticId; editorStore mutators all guard with `if (get().isX()) return` [src/stores/tacticsStore.ts:98,142]
- [x] [Review][Patch] selectTactic accepts an id not in the tactics list and fetchTactics never reconciles activeTacticId — dangling activeTacticId silently resolves to undefined for story 3.2+ consumers [src/stores/tacticsStore.ts:63-81,192]
- [x] [Review][Patch] Fixture goalkeeper sits at midfield (x=50) while its comment says "home attacks toward x=100" — GK belongs near x=0; same midfield GK in TacticTest formationPayload [tests/support/fixtures/factories/match-factory.ts:63, lachatadede-api/tests/Feature/Tactics/TacticTest.php:33]
- [x] [Review][Patch] match-factory cleanup deletes tactics without an Authorization header — silent 401 (swallowed by catch) leaves tactic rows behind in e2e runs; add the bearer header like createTactic does [tests/support/fixtures/factories/match-factory.ts:159-165]
- [x] [Review][Defer] tacticsStore has no 401 recovery path (expired/revoked token mid-session → every action errors "Unauthenticated." until a page reload) — deferred: mirrors editorStore's existing caller-decides-401 pattern; a global auth policy should be decided once [src/stores/tacticsStore.ts:98-190]
- [x] [Review][Defer] updateTactic success with id absent from the local list is a silent local no-op (server persisted, UI stale, no error) — deferred: defensive reconciliation once story 3.2 defines the lineup UI [src/stores/tacticsStore.ts:169-175]

## Senior Developer Review (AI)

**Review Date:** 2026-09-12
**Method:** gds-code-review (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor)
**Result:** PASSED with fixes applied

### Issues Found and Fixed (10)

**HIGH (2 - fixed):**
1. `players: null` on PUT silently wiped the entire lineup (inconsistent with `name: null` keeping the name) — explicit null now treated as "no change" (`has()` + null check, empty array still a valid full clear); decision by Pelo — regression test added
2. restoreSession cleared the token on ANY ApiError (transient 5xx/429 logged users out) — now only `status === 401` clears; 503 regression test added; pre-existing test tightened to a real 401

**MEDIUM (5 - fixed):**
3. Same owned script in 2+ slots falsely rejected 422 — ownership count now deduped via `array_unique`; acceptance test added
4. Script-deletion TOCTOU surfaced FK violations as 500 — QueryException caught around both transactions, 422 with ownership message
5. Players-only PUT left `updated_at` stale (index orders by it) — `touch()` when replacing players without a name change; travel-based regression test added
6. No in-flight guard on saveTactic/updateTactic (double-click duplicated tactics) — `isSavingTactic` guards mirroring editorStore
7. match-factory cleanup deleted tactics without Authorization header (silent 401, rows left behind) — token captured at create, header sent, non-ok warned

**LOW (3 - fixed):**
8. apiFetch threw raw TypeError on JSON-null error body — optional chaining; regression test added
9. selectTactic accepted unknown ids and fetchTactics left dangling activeTacticId — selection validated against the list, selection reconciled after fetch; tests added
10. GK fixture at midfield (x=50) contradicted "attacks toward x=100" comment — GK moved to x=8 in match-factory and TacticTest formationPayload (assertion updated)

**Record correction:** Task 6's "behavior must be identical" holds for all tested paths; non-JSON error bodies now yield the generic auth message by design (accepted by Pelo).

**Verification:** backend 52/52 tests, 213 assertions, Pint clean on touched files. Frontend 269/269 unit tests, `tsc -b` clean, ESLint 0 errors.
