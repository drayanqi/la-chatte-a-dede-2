# lachatadede-api — Agent Guidelines

## Migration law (non-negotiable)

- Migrations are FORWARD-ONLY. No `down()` method, ever.
- To reverse a change: write a new forward migration.
- Never run `migrate:rollback`, `migrate:refresh` or `migrate:reset` — with no `down()` they are dead ends. Local reset = `php artisan migrate:fresh` (dev only — drops all data).
- Rollback in production = redeploy previous image tags (sha-*) + forward fix.
- Never edit a migration that has shipped to production ("shipped" = included in a deployed production image tag). Exception: the 2026-09-23 one-time removal of every `down()` method.

## Stack

- Laravel 12, PHP 8.4 (composer requires ^8.2; CI and Docker use 8.4)
- Tests: sqlite `:memory:` via `RefreshDatabase` (phpunit.xml) — MySQL 8 in production
- Auth: Sanctum tokens (personal_access_tokens)

## Commands

```bash
composer install --prefer-dist --no-interaction --no-progress
php artisan test
php artisan migrate --force   # prod-style; only ever applies pending
```

## Conventions

- English-only code and comments
- Pint: note there are pre-existing Pint findings in AuthController, ScriptController, LoginTest — leave them, do not "fix" unrelated files
