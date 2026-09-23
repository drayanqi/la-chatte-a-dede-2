---
baseline_commit: a4bf3f89a8dac6bb9aee6239155645138f1f2cd3
---

# Story 6.1: Forward-Only Migrations & Project Guidelines

Status: done

## Story

As the operator,
I want every `down()` method removed from the migrations and the forward-only law recorded in `lachatadede-api/AGENTS.md`,
So that the schema only ever moves forward and "undo" is an ops action (previous image + forward fix), not dead code.

## Acceptance Criteria

1. **Given** the migration files in `lachatadede-api/database/migrations/` (12 files exist today — epics said 11, `2026_09_21_000000_add_team_customization_to_tactics_table.php` landed with story 7.4; the rule applies to all of them), **When** they are reviewed, **Then** no file contains a `down()` method (`grep -r "function down" database/migrations` returns nothing) **And** every `up()` body is byte-identical to before (nothing else changes).
2. **Given** the CI suite (backend tests, E2E), **When** it runs after the removal, **Then** it stays green (`RefreshDatabase` and `migrate:fresh` never call `down()` — the one `migrate:fresh` caller is the E2E webserver in `playwright.config.ts`, which drops tables directly and re-runs `up()`; zero `down()` callers exist in workflows, `scripts/`, docs, app code, or tests).
3. **Given** `lachatadede-api/AGENTS.md` (new file), **When** it is read, **Then** it states the migration law: migrations are forward-only, no `down()` ever; to reverse, write a new forward migration; rollback = redeploy previous image + forward fix **And** it carries minimal project pointers (stack layout, test commands) so any agent working in `lachatadede-api/` inherits them.
4. **Given** a fresh database, **When** `php artisan migrate --force` runs, **Then** all migrations apply cleanly and `php artisan test` passes.

## Scope Boundary (read first)

- This story is **mechanical + documentation**. It must not touch any `up()` body, schema column, index, or migration file name. If you find yourself editing SQL inside an `up()`, stop — that's a violation of AC 1.
- No deploy infrastructure changes (no compose, workflows, Dockerfile edits — 6.3 owns those).
- No new migrations. The 7.4 team-customization migration already exists and is forward-only compliant once its `down()` is removed.
- Do not "improve" or reformat migrated files beyond deleting the `down()` method (and nothing else). The diff per file should be exactly the removal of the `down()` block.

## Tasks / Subtasks

- [x] Task 1: Remove `down()` from all migrations (AC: 1, 4)
  - [x] 1.1 List files: `ls lachatadede-api/database/migrations/` — expect 12 files (see Dev Notes for the exact list with current `down()` line numbers)
  - [x] 1.2 In each file, delete the entire `public function down(): void { ... }` method including its docblock if any. Keep imports/class structure valid.
  - [x] 1.3 Verify: `grep -r "function down" lachatadede-api/database/migrations` → zero results
  - [x] 1.4 Verify byte-stability of `up()`: `git diff` shows ONLY `down()` removals (no stray whitespace/import edits)
- [x] Task 2: Verify CI safety (AC: 2)
  - [x] 2.1 Confirm zero callers already verified at story creation: `grep -rn "migrate:rollback\|migrate:fresh" .github/ scripts/ docs/ lachatadede-api/app/ lachatadede-api/routes/ lachatadede-api/tests/ lachatadede-api/database/` (excluding vendor) → zero results (re-run to be safe)
  - [x] 2.2 Note: tests use `RefreshDatabase` (11 test files) which rebuilds the schema from migration files each run — `down()` is never invoked. phpunit runs on sqlite `:memory:` (see `lachatadede-api/phpunit.xml`).
- [x] Task 3: Create `lachatadede-api/AGENTS.md` (AC: 3)
  - [x] 3.1 State the migration law (see Dev Notes §AGENTS.md skeleton for required content)
  - [x] 3.2 Add stack pointers (Laravel 12 / PHP 8.4, sqlite in tests, MySQL 8 in prod) and test commands (`php artisan test`; `composer install --prefer-dist --no-interaction --no-progress` first)
  - [x] 3.3 Add repo conventions that apply here: English-only code/comments, TypeScript strict applies to sibling `lachatadede-engine/`, no `down()` ever, rollback = redeploy previous image + forward fix
- [x] Task 4: Run the verification commands (AC: 4)
  - [x] 4.1 `cd lachatadede-api && php artisan migrate --force` against a fresh local database (or `php artisan migrate:fresh` once locally — allowed for dev, it never calls `down()` anymore since none exist)
  - [x] 4.2 `php artisan test` → all green (121 backend tests existed at story 7.4 completion; count may drift upward, none may fail)

### Review Findings

- [x] [Review][Decision] Define "shipped" (law reads as self-conflicting) — the law's "never edit a migration that has shipped to production" collides with this story's own edit of 12 migrations and never defines "shipped" (deployed in a prod `sha-*` image? merged?). Suggested: define shipped = included in a deployed production image tag, and note the one-time `down()` removal as the permitted exception. [lachatadede-api/AGENTS.md:8] — resolved 2026-09-23: definition + exception added to the law
- [x] [Review][Decision] Law is silent on rollback/reset commands — `migrate:rollback`/`refresh`/`reset` are dead-ends now that no `down()` exists, and `migrate:fresh` (the safe local reset) is destructive and undocumented. Suggested one-line addition: "Never run migrate:rollback/refresh/reset. Local reset = `php artisan migrate:fresh` (dev only — drops all data)." [lachatadede-api/AGENTS.md:5-7] — resolved 2026-09-23: law line added
- [x] [Review][Defer] No CI guard prevents future `down()` reintroduction [lachatadede-api/database/migrations/] — deferred: new test/CI check is out of this story's mechanical+doc scope; candidate for 6.3 CI hardening
- [x] [Review][Defer] Generator stubs still scaffold a `down()` method [lachatadede-api/AGENTS.md] — deferred: `stub:publish` + stripping the stubs is a follow-up hygiene task, not part of this story
- [x] [Review][Defer] No failed-migration recovery runbook (MySQL DDL autocommits; half-applied ALTER persists) [lachatadede-api/AGENTS.md] — deferred: ops runbook is story 6.5's territory
- [x] [Review][Defer] No MySQL-parity validation (tests sqlite `:memory:` vs prod MySQL 8: identifier limits, enum/charset, `->change()` semantics) [lachatadede-api/AGENTS.md:13] — deferred: CI job with MySQL 8 service belongs to 6.3
- [x] [Review][Defer] composer requires `^8.2` while CI/Docker use 8.4 — no platform pin [composer.json] — deferred: pre-existing; `composer config platform.php 8.4.0` is a separate change
- [x] [Review][Defer] Law has no data-backfill policy (data changes belong in batched commands, not migrations) [lachatadede-api/AGENTS.md] — deferred: AGENTS.md v2 / 6.5 runbook content
- [x] [Review][Defer] No squash/consolidation policy for obsolete chains (build-then-drop churn, `schema:dump --prune`) [database/migrations/] — deferred: ops decision, candidate for 6.5; chain replay quirk already documented in story Dev Notes
- [x] [Review][Defer] Migration law discoverability — AGENTS.md sits in `lachatadede-api/`; agents entering at repo root never load it [lachatadede-api/AGENTS.md] — deferred: root-level pointer is outside this story's mandated file list

(2 findings dismissed as noise: Pint "leave findings" clause — that exact line is mandated by the spec skeleton; law rationale line — skeleton content is spec-fixed and the rationale lives in the story/epics.)

## Verification

- `grep -r "function down" lachatadede-api/database/migrations` → empty
- `git diff` limited to: `down()` method deletions + new `lachatadede-api/AGENTS.md`
- `php artisan test` (in `lachatadede-api/`) green
- CI backend-tests job green on the PR

## Dev Notes

**Why forward-only (Epic 6 context, decision locked with Pelo 2026-09-20):** production deploys become image-based (GHCR tags, story 6.3). The undo path for a bad release is: redeploy the previous `sha-*` images, then write a forward migration fixing the schema. `down()` code rots (it is never exercised by CI or prod) and gives a false sense of safety — removing it makes the ops reality the only reality.

**Verified current state (2026-09-23, commit a4bf3f8):**

- 12 migration files, ALL containing `public function down(): void`:
  - `0001_01_01_000000_create_users_table.php` (down at line ~51)
  - `0001_01_01_000001_create_cache_table.php` (~30)
  - `0001_01_01_000002_create_jobs_table.php` (~51)
  - `2026_01_22_072806_create_personal_access_tokens_table.php` (~29)
  - `2026_02_01_194832_fix_personal_access_tokens_uuid_support.php` (~29)
  - `2026_09_11_000000_harden_users_and_tokens_schema.php` (~35)
  - `2026_09_12_000000_create_tactics_tables.php` (~41)
  - `2026_09_13_000000_add_is_valid_to_scripts_table.php` (~22)
  - `2026_09_14_000000_create_matches_table.php` (~46)
  - `2026_09_17_000000_create_matchmaking_queue_table.php` (~44)
  - `2026_09_19_000000_ready_tactics_drop_queue.php` (~39)
  - `2026_09_21_000000_add_team_customization_to_tactics_table.php` (~18)
- Zero callers of `migrate:rollback` or `->down()` anywhere outside vendor (`.github/workflows/`, `scripts/`, `docs/`, app code, tests) — removal cannot break anything. `php artisan migrate --force` is used by the deploy pipeline (test.yml Stage 6).
- **One `migrate:fresh` caller exists and is SAFE** (do not "fix" it): `playwright.config.ts:82` runs `php artisan migrate:fresh --force` to boot the E2E Laravel server. `migrate:fresh` drops all tables directly (schema-level) and re-runs every `up()` — it never invokes `down()`. This is also the local-dev fresh-database command; after this story it is down()-free by construction.
- **No `AGENTS.md` exists anywhere in the repo** (checked via glob) — the file is genuinely new, not an edit.
- Migration chain quirk to be aware of (not to change): `2026_09_19_000000_ready_tactics_drop_queue.php` drops `matchmaking_queue` created by `2026_09_17_...` — fresh databases replay create → drop by design (story 4.1 decision: old migration kept so history replays).

**AGENTS.md skeleton (minimum, keep it short — it is loaded by every agent working in `lachatadede-api/`):**

```markdown
# lachatadede-api — Agent Guidelines

## Migration law (non-negotiable)
- Migrations are FORWARD-ONLY. No `down()` method, ever.
- To reverse a change: write a new forward migration.
- Rollback in production = redeploy previous image tags (sha-*) + forward fix.
- Never edit a migration that has shipped to production.

## Stack
- Laravel 12, PHP 8.4 (composer requires ^8.2; CI and Docker use 8.4)
- Tests: sqlite :memory: via RefreshDatabase (phpunit.xml) — MySQL 8 in production
- Auth: Sanctum tokens (personal_access_tokens)

## Commands
- composer install --prefer-dist --no-interaction --no-progress
- php artisan test
- php artisan migrate --force   (prod-style; only ever applies pending)

## Conventions
- English-only code and comments
- Pint: note there are pre-existing Pint findings in AuthController, ScriptController, LoginTest — leave them, do not "fix" unrelated files
```

**Do not add:** roadmap content, opinions on other directories, secrets, or env values. AGENTS.md is a law + orientation file, not a wiki.

### Project Structure Notes

- File touched: `lachatadede-api/database/migrations/*.php` (12 files, down() removed)
- File created: `lachatadede-api/AGENTS.md`
- No file moves, no renames. The migrations directory listing must remain identical before/after.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.1-Forward-Only-Migrations-and-Project-Guidelines] (ACs, law)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-6] (implementation note: forward-only law lives in `lachatadede-api/AGENTS.md`)
- [Source: lachatadede-api/phpunit.xml] (sqlite :memory:, RefreshDatabase test base)
- [Source: .github/workflows/test.yml#backend-tests] (`php artisan test`, PHP 8.4)
- [Source: story 7.4 dev notes] (12th migration added; Pint pre-existing findings)

## Dev Agent Record

### Agent Model Used

euria-code (infomaniak/euria-code)

### Debug Log References

- `grep -r "function down" lachatadede-api/database/migrations` → no matches (exit 1) after removal
- `grep -rn "migrate:rollback\|migrate:fresh" .github/ scripts/ docs/ lachatadede-api/app/ lachatadede-api/routes/ lachatadede-api/tests/ lachatadede-api/database/` → no matches; sole `migrate:fresh` remains `playwright.config.ts:82` (E2E server boot — drops tables directly, never calls `down()`)
- `php artisan migrate --force` on a deleted-and-recreated `database/database.sqlite` → all 12 migrations applied DONE
- `php artisan test` → 121 passed (642 assertions), 0 failures
- `./vendor/bin/pint --test database/migrations` → pass (no style findings introduced)

### Completion Notes List

- Removed the `down()` method (and its `/** Reverse the migrations. */` docblock where present) from all 12 migration files. Net diff: 118 deletions, 0 additions — every `up()` body is byte-identical to before, no imports/whitespace touched.
- Created `lachatadede-api/AGENTS.md` following the Dev Notes skeleton exactly: migration law, stack pointers (Laravel 12 / PHP 8.4, sqlite `:memory:` tests vs MySQL 8 prod, Sanctum tokens), commands, and conventions (English-only, pre-existing Pint findings left alone).
- CI safety confirmed: zero `migrate:rollback`/`migrate:fresh` callers in workflows, scripts, docs, app, routes, tests, database. The single root-level `migrate:fresh` in `playwright.config.ts` is safe by construction (schema-level drop + `up()` replay).
- Note: the working tree also carries unrelated pre-existing modifications belonging to stories 7-6/7-7/7-8 (in review) — untouched by this story; its diff is strictly the 12 migrations + new AGENTS.md.
- E2E suite and the CI backend-tests job are not runnable from this local story session; `php artisan test` is green locally, and CI will validate backend-tests + E2E on the PR (playwright E2E uses `migrate:fresh`, unaffected by `down()` removal).

### File List

- lachatadede-api/database/migrations/0001_01_01_000000_create_users_table.php (down() removed)
- lachatadede-api/database/migrations/0001_01_01_000001_create_cache_table.php (down() removed)
- lachatadede-api/database/migrations/0001_01_01_000002_create_jobs_table.php (down() removed)
- lachatadede-api/database/migrations/2026_01_22_072806_create_personal_access_tokens_table.php (down() removed)
- lachatadede-api/database/migrations/2026_02_01_194832_fix_personal_access_tokens_uuid_support.php (down() removed)
- lachatadede-api/database/migrations/2026_09_11_000000_harden_users_and_tokens_schema.php (down() removed)
- lachatadede-api/database/migrations/2026_09_12_000000_create_tactics_tables.php (down() removed)
- lachatadede-api/database/migrations/2026_09_13_000000_add_is_valid_to_scripts_table.php (down() removed)
- lachatadede-api/database/migrations/2026_09_14_000000_create_matches_table.php (down() removed)
- lachatadede-api/database/migrations/2026_09_17_000000_create_matchmaking_queue_table.php (down() removed)
- lachatadede-api/database/migrations/2026_09_19_000000_ready_tactics_drop_queue.php (down() removed)
- lachatadede-api/database/migrations/2026_09_21_000000_add_team_customization_to_tactics_table.php (down() removed)
- lachatadede-api/AGENTS.md (new)

### Change Log

- 2026-09-23: Story 6.1 implemented — forward-only migration law enforced (all `down()` methods removed) and `lachatadede-api/AGENTS.md` created with migration law, stack pointers, commands and conventions.
- 2026-09-23: Code review passed (3 layers: edge-case + acceptance clean, 2 decisions resolved as law clarifications, 8 items deferred) — AGENTS.md law gained the `shipped` definition + one-time exception and the rollback-commands prohibition.
