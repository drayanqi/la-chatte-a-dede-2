---
baseline_commit: a4bf3f89a8dac6bb9aee6239155645138f1f2cd3
---

# Story 6.5: Database Backups & Operations Runbook

Status: ready-for-dev

## Story

As the operator,
I want nightly database backups plus a runbook that matches the deployed reality,
So that forward-only migrations have a real undo and the box is operable without archaeology.

## Acceptance Criteria

1. **Given** `deploy/backup.sh`, **When** it runs, **Then** it dumps all databases (gzip) to `/home/debian/lachatadede/backups/` and prunes to the 7 most recent **And** it replaces the inline pre-migrate dump from 6.3 (same mechanism, formalized with retention).
2. **Given** Ansible, **When** configured, **Then** a nightly cron (03:30) runs the backup.
3. **Given** a backup file, **When** the one-time restore drill runs into a scratch database, **Then** the restore succeeds and the drill is documented.
4. **Given** the docs, **When** `docs/DEPLOYMENT.md` and `docs/ci-secrets-checklist.md` are reviewed, **Then** they describe the real system: GHCR pipeline, four services, HTTPS, backups, restore drill **And** the secrets list reads: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `APP_KEY`, `GHCR_PAT` (DOCKERHUB_* removed).
5. **Given** the health check, **When** the deploy finishes, **Then** it hits `GET /api/health` (new public route exercising PHP→MySQL), not nginx's static 200.

## Scope Boundary (read first)

- Backups stay **on the box** (`/home/debian/lachatadede/backups/`) — VPS Lite has no provider snapshots, which is why the dumps exist at all; off-box sync is explicitly out of scope (note it as a future item in the runbook).
- No backup tooling new to learn: same `mysqldump` mechanism the 6.3 pre-migrate step already proved on the box, now wrapped in a script + cron.
- `GET /api/health` is a Laravel route (public, no auth) that fails loudly when MySQL is unreachable. It is NOT a metrics/monitoring endpoint — no external uptime monitor in this story.
- After 6.4, port 80 answers only ACME + (new) `/api/health` and 301s everything else — the health-check exception in the port-80 server block is REQUIRED, or `curl -f http://localhost/api/health` gets a 301 and the deploy check lies.
- This story CLOSES Epic 6: the deploy script, compose, playbook, nginx conf, and docs all get their final state here.

## Tasks / Subtasks

- [ ] Task 1: Create `deploy/backup.sh` (AC: 1)
  - [ ] 1.1 Script (run as debian on the box): `cd /home/debian/lachatadede/deploy`, `mkdir -p ../backups`, dump: `docker compose exec -T mysql sh -c 'exec mysqldump --all-databases -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction' | gzip > ../backups/all-$(date +%Y%m%d-%H%M%S).sql.gz`, prune: keep the 7 newest `*.sql.gz` in the dir regardless of prefix (`ls -1t ../backups/*.sql.gz | tail -n +8 | xargs -r rm -f`) — one retention rule for nightly + pre-migrate dumps, log failures to stderr with a nonzero exit
  - [ ] 1.2 `--single-transaction` for a consistent InnoDB dump without locking; verify the dump is non-empty (fail if `! -s`) — an empty file that prunes real backups is worse than a failed backup
- [ ] Task 2: Replace the inline pre-migrate dump in the deploy script (AC: 1)
  - [ ] 2.1 `.github/workflows/test.yml` Stage 6: the scp step ships `deploy/backup.sh` alongside compose + `.env.example`; in the SSH script, the inline `mysqldump | gzip` block from 6.3 becomes `chmod +x backup.sh && ./backup.sh` (before `php artisan migrate --force`, same position)
- [ ] Task 3: Ansible nightly cron (AC: 2)
  - [ ] 3.1 `deploy/ansible/playbook.yml`: `cron` module task — `name: nightly database backup`, `minute: 30`, `hour: 3`, `user: debian`, `job: /home/debian/lachatadede/deploy/backup.sh >> /home/debian/lachatadede/backups/cron.log 2>&1`
  - [ ] 3.2 The playbook also ensures `backups/` exists (mode 0755, owner debian)
  - [ ] 3.3 Run the playbook (idempotent re-run) and confirm `crontab -l -u debian` shows the entry; run `deploy/backup.sh` once by hand and watch the dump land
- [ ] Task 4: Add `GET /api/health` (AC: 5)
  - [ ] 4.1 `lachatadede-api/routes/api.php`: public route OUTSIDE the `auth:sanctum` group — `Route::get('/health', …)` returning `{"status":"ok"}`; it MUST touch MySQL (`DB::select('select 1')`) so an unreachable DB throws → HTTP 500 (the deploy curl then fails)
  - [ ] 4.2 Feature test `tests/Feature/HealthCheckTest.php`: 200 + JSON structure on the happy path (sqlite in tests — the DB dependency is structural: the route calls `DB::select`, there is no mock)
- [ ] Task 5: Health-check plumbing end-to-end (AC: 5)
  - [ ] 5.1 `deploy/nginx/default.conf` 443 server: `/api/` fastcgi block already covers `/api/health` — nothing to add there
  - [ ] 5.2 `deploy/nginx/default.conf` port-80 server: add `location = /api/health { fastcgi_pass laravel:9000; …same params as the 443 /api/ block… }` NEXT TO the ACME location (exact match — no redirect, everything else still 301s)
  - [ ] 5.3 `.github/workflows/test.yml` deploy script: `curl -f -s --max-time 10 http://localhost/health` → `curl -f -s --max-time 10 http://localhost/api/health`
  - [ ] 5.4 Negative check: `docker compose stop mysql` → health check returns 500 → deploy would fail; start mysql again (do this drill on the box, then clean up)
- [ ] Task 6: Restore drill (AC: 3)
  - [ ] 6.1 On the box (one-time, documented commands): `docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE restore_drill"`; `gunzip < backups/all-<newest>.sql.gz | docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" restore_drill`; sanity-verify: table count + a `SELECT COUNT(*)` on `users`/`matches` matches expectations; `DROP DATABASE restore_drill`
  - [ ] 6.2 Write the drill as a copy-pasteable block in DEPLOYMENT.md (Task 7) — "documented" means the next operator runs it from the doc, not from archaeology
- [ ] Task 7: Runbook rewrite — `docs/DEPLOYMENT.md` (AC: 4)
  - [ ] 7.1 Architecture section: the REAL box (Infomaniak VPS Lite 2GB Debian 12 Geneva + 2GB swap) and the four services with images (`ghcr.io/drayanqi/la-chatte-a-dede-2/{web,api,engine}`, `mysql:8.0`), tuned MySQL, storage/backups mounts
  - [ ] 7.2 Pipeline section: push to main → lint/unit/backend/E2E → Stage 6 builds 3 images → GHCR (`latest` + `sha-<sha>`) → scp compose/backup.sh → VPS: ghcr login → pull → up 4 services → pre-migrate backup (backup.sh) → migrate --force → caches → `/api/health` check
  - [ ] 7.3 Provisioning section (6.2 content, final): Infomaniak order flow, SSH key at console, DNS A record, `ansible-playbook -i deploy/ansible/inventory.yml deploy/ansible/playbook.yml`
  - [ ] 7.4 HTTPS section (6.4 content, final): certbot webroot, renewal timer + hook, `certbot renew --dry-run`
  - [ ] 7.5 Operations section (NEW): rollback one-command (`IMAGE_TAG=sha-<old> docker compose pull && docker compose up -d` + forward fix — reference the 6.1 migration law), backup layout + retention (nightly `all-*` + pre-migrate dumps share `/home/debian/lachatadede/backups/`, single keep-7 rule across all `*.sql.gz`), restore drill block, useful commands (logs, ps, exec), MySQL 2GB tuning rationale
  - [ ] 7.6 Purge every stale claim: 4GB specs, git-clone deploy, Docker Hub, scp of dist, "node is placeholder/never started", HTTP-only health
- [ ] Task 8: Secrets doc — `docs/ci-secrets-checklist.md` (AC: 4)
  - [ ] 8.1 Replace the placeholder table with the real list: `VPS_HOST`, `VPS_USER` (debian), `VPS_SSH_KEY`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `APP_KEY`, `GHCR_PAT` (read:packages, VPS pull) — plus the workflow-internal `GITHUB_TOKEN` (packages:write, CI push, not a user secret)
  - [ ] 8.2 Note DOCKERHUB_USERNAME/TOKEN as REMOVED (delete them from GitHub repo settings during this story)
  - [ ] 8.3 Keep the existing how-to (gh CLI, security practices) — it's good

## Verification

- `deploy/backup.sh` run by hand → dump appears, 8th-oldest is pruned after 8 runs (test retention locally with dummy files if needed)
- `crontab -l -u debian` → 03:30 entry; wait or force-run once via `systemctl`-less `run-parts` check — at minimum the entry exists and the script exits 0 standalone
- Restore drill: scratch DB restored, row counts sane, drill dropped
- `curl -f http://venanciohugo.fr/api/health` → `{"status":"ok"}` over plain HTTP (no redirect) AND over HTTPS; with mysql stopped → 500
- CI deploy logs show `./backup.sh` output + the `/api/health` check passing
- Docs: both files read as ONE coherent runbook for the system that actually exists; no DOCKERHUB anywhere (`grep -rn "dockerhub\|DOCKERHUB" .github/ deploy/ docs/` → zero)
- `php artisan test` green incl. the new HealthCheckTest

## Dev Notes

**Epic context (closing story):** nightly + pre-migrate DB backups are the in-epic mitigation for "VPS Lite has no provider snapshots" (Epic 6 implementation note), and they are the "real undo" for forward-only migrations (6.1): rollback = previous image tags + restore last night's dump if the schema change broke data, then forward fix. The runbook ACs enumerate exactly what 6.2–6.5 built — this story is where the docs stop lying.

**Backup mechanics that bite:**

- `mysqldump --all-databases` from inside the mysql container uses the root password from the container env (`MYSQL_ROOT_PASSWORD` — interpolated by compose from `deploy/.env`). The script reads it INSIDE the container (`sh -c 'exec mysqldump … -p"$MYSQL_ROOT_PASSWORD"'`) so the password never appears in host process listings or cron logs.
- `--single-transaction`: consistent dump of InnoDB tables without LOCK TABLES — the app stays up during the nightly dump. Do not add `--lock-all-tables`.
- Retention decision (locked): **`backup.sh` handles BOTH nightly and pre-migrate dumps** — the deploy script calls it pre-migrate (replacing 6.3's inline dump), cron calls it nightly; retention = keep the 7 newest `*.sql.gz` in the dir, regardless of prefix. One script, one dir, one retention rule — the "same mechanism, formalized with retention" the AC asks for. Frequent deploy days may prune older nightly dumps — acceptable at this scale; the 7 kept files still span multiple days.
- Cron runs as `debian` (docker group member from 6.2) — `docker compose` must work unprivileged in that shell; the compose file lives at `/home/debian/lachatadede/deploy/docker-compose.yml` (scp'd each deploy by 6.3).
- Log noise: cron job appends to `backups/cron.log` — mention rotation or keep the log small (a few lines per night; fine for this box).

**`GET /api/health` design:** one closure route in `routes/api.php`, registered BEFORE/OUTSIDE any middleware groups that would auth-gate it (the current file has `throttle:auth` and `auth:sanctum` groups — the health route belongs in neither; if you want throttling use the default api throttle, but a health endpoint being rate-limited can cause false deploy failures — leave it unthrottled). The MySQL touch is the entire point: PHP booted, framework up, DB reachable. A 500 on DB-down is the contract the deploy script (curl -f) and any future monitoring rely on.

**Port-80 exception (don't skip):** after 6.4 the port-80 server is `return 301` for everything except `^.well-known/acme-challenge`. `curl -f http://localhost/api/health` would follow nothing and receive a 301 — which `curl -f` treats as SUCCESS (only ≥400 fails). Without the `location = /api/health` exception, the deploy gate silently checks nothing. The exact-match location re-uses the 443 block's fastcgi params.

**The docs rewrite is the deliverable, not an afterthought** — AC 4 reads them as the acceptance surface. Write DEPLOYMENT.md as the operator's single entry point: what exists, how it deploys, how to roll back, how to restore, where the logs are. If a section can't be executed from the doc alone, it's not done.

**Secrets final list (AC 4, verbatim):** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `APP_KEY`, `GHCR_PAT`. CI image push uses the workflow-scoped `GITHUB_TOKEN` with `packages: write` (6.3) — document it as "not a repository secret".

### Project Structure Notes

- Created: `deploy/backup.sh` (executable), `lachatadede-api/tests/Feature/HealthCheckTest.php`
- Modified: `lachatadede-api/routes/api.php` (one public route), `.github/workflows/test.yml` (scp list + backup.sh call + health URL), `deploy/nginx/default.conf` (port-80 exact-match health exception), `deploy/ansible/playbook.yml` (cron + backups dir), `docs/DEPLOYMENT.md` (full rewrite), `docs/ci-secrets-checklist.md` (real secrets list)
- Untouched: `deploy/docker-compose.yml` (unless the health exception needs no compose change — it doesn't), Dockerfiles, compose.local
- GitHub UI action (not a file): delete `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` secrets

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.5-Database-Backups-and-Operations-Runbook] (ACs verbatim)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-6] (no provider snapshots → dumps; forward-only law; secrets list)
- [Source: story 6.3] (inline pre-migrate dump step being formalized, scp step shape, /health curl)
- [Source: story 6.4] (port-80 redirect — the health exception reason)
- [Source: docs/DEPLOYMENT.md] (outdated content being rewritten)
- [Source: docs/ci-secrets-checklist.md] ("no secrets required" placeholder being replaced)
- [Source: lachatadede-api/routes/api.php] (route groups — health goes outside both)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
