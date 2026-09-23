---
baseline_commit: a4bf3f89a8dac6bb9aee6239155645138f1f2cd3
---

# Story 6.3: CI Builds Images to GHCR, VPS Pulls & Runs All Four Services

Status: ready-for-dev

## Story

As a player,
I want every push to `main` (E2E-green) to deploy the full app automatically,
So that new code reaches production with zero manual steps — and a bad build rolls back with one command.

## Acceptance Criteria

1. **Given** a push to `main` with lint/unit/backend/E2E green, **When** deploy (Stage 6 of `test.yml`) runs, **Then** CI builds three images and pushes them to GHCR with tags `latest` and `sha-<sha>`: `api` (Dockerfile.api, production target), `web` (new multi-stage Dockerfile.web: Vite build baked into nginx — no more scp), `engine` (Dockerfile.node).
2. **Given** the deploy step on the VPS, **When** it executes, **Then** it logs into ghcr.io (PAT, read:packages), runs `docker compose pull`, `docker compose up -d` for **all four services** (nginx, laravel, node, mysql — `node` is finally started), runs a pre-migrate `mysqldump`, then `php artisan migrate --force`, caches config/routes, and passes a health check.
3. **Given** `deploy/docker-compose.yml`, **When** reviewed, **Then** services reference `ghcr.io/...` images (no `build:` in the production compose) **And** MySQL is tuned for the 4 GB box (`innodb_buffer_pool_size=512M`, `max_connections=100`) **And** vestigial mounts and the unused Docker Hub login are gone.
4. **Given** the old deploy path, **When** reviewed, **Then** the frontend scp step, the on-VPS `docker compose build`, and the manual `deploy.yml` are deleted (one pipeline, no drift).
5. **Given** a completed deploy, **When** I open the site, **Then** the game loads and a new user can register and log in through the UI. (TLS note: 6.3 verification runs over `http://venanciohugo.fr`; `https://` becomes true when 6.4 lands — the AC text describes the epic-end state.)
6. **Given** a bad release, **When** the previous `sha-*` image tags are redeployed, **Then** the app returns to that build (rollback = previous images + forward fix, not `down()`).

## Scope Boundary (read first)

- **Nothing is built on the VPS** — that is the whole point. The box only ever runs `docker compose pull && up`. If you find a `docker build` in the deploy script, stop.
- Three images built in CI, **one** image created by hand on the box: none. MySQL stays the stock `mysql:8.0` image.
- What still travels to the box each deploy: `deploy/docker-compose.yml` (+ `deploy/.env.example` for first-boot bootstrap) via scp. What dies: the git clone/pull on the VPS, the `dist/*` scp to `lachatadede-api/public/build`, the Docker Hub login, the on-box `docker compose build laravel`.
- The nginx config is **baked into the web image** (single self-contained artifact; an image rollback carries its own conf). TLS additions to the conf land in 6.4.
- Do NOT touch the E2E/unit/lint stages of `test.yml` — only Stage 6 (the `deploy` job).
- `deploy/docker-compose.local.yml` (local dev overlay) must keep working: it re-adds `build:` targets for dev (compose merge semantics allow an overlay to add build to an image: service — verify `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml config` still resolves).
- Health check in 6.3 stays nginx's static `/health`; the real `GET /api/health` (PHP→MySQL) arrives in 6.5.
- Pre-migrate dump in 6.3 is an inline mysqldump step; 6.5 formalizes it into `deploy/backup.sh` with retention. Write it so 6.5 can lift it verbatim.

## Tasks / Subtasks

- [ ] Task 1: Create `deploy/docker/Dockerfile.web` (AC: 1)
  - [ ] 1.1 Multi-stage: `node:24-alpine` build stage (`npm ci`, `npm run build` — which is `tsc -b && vite build`, output `dist/`), then `nginx:alpine` final stage: `COPY --from=build /app/dist /usr/share/nginx/html` + `COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf`
  - [ ] 1.2 Build context = repo root (frontend + conf live at root level). Create a root `.dockerignore` (new file — none exists) excluding: `node_modules`, `dist`, `test-results`, `coverage`, `lachatadede-api`, `lachatadede-engine`, `_bmad*`, `docs`, `.git`, `deploy/ansible`, `playwright-report`, `raw`, `pitch-preview.png` — **keep `deploy/nginx/` IN the context** (Dockerfile.web COPYs `deploy/nginx/default.conf`)
- [ ] Task 2: Rewrite `deploy/docker-compose.yml` to registry images (AC: 3, 6)
  - [ ] 2.1 Image refs: `ghcr.io/drayanqi/la-chatte-a-dede-2/api:${IMAGE_TAG:-latest}`, `.../web:${IMAGE_TAG:-latest}`, `.../engine:${IMAGE_TAG:-latest}` (lowercase required by GHCR); `mysql:8.0` unchanged; all tags share `IMAGE_TAG` so rollback is one variable
  - [ ] 2.2 Remove ALL `build:` blocks and the `laravel_vendor` volume + `../frontend-dist` + `../lachatadede-api/public` mounts (vendor and dist are baked into images now)
  - [ ] 2.3 Storage: keep bind mounts but rebase to the deploy dir — laravel: `/home/debian/lachatadede/storage:/var/www/html/storage` (+ bootstrap/cache: make it a named volume `laravel_bootstrap` — the host no longer has a repo checkout), engine: **`/home/debian/lachatadede/storage:/var/www/html/storage` — the SAME container path as laravel, NOT `/app/storage`** (reason in Dev Notes: the engine writes frames to the literal `output_path` Laravel sends, which is Laravel's `/var/www/html/storage/simulations`; today's `/app/storage` mount is a latent bug that would break every match). Host dir created by ansible 6.2; make it writable by container uids www-data(33) + node(1000) — `chmod 777` on that one dir is acceptable on this single-tenant box, document the tradeoff in a comment
  - [ ] 2.4 mysql command tuning: `command: --innodb-buffer-pool-size=128M --max-connections=50` (keep healthcheck as-is)
  - [ ] 2.5 Keep: service names (nginx/laravel/node/mysql — the deploy AC and local overlay reference them), network `lachatadede_net`, `restart: unless-stopped`, all environment vars (incl. `GAME_ENGINE_URL=http://node:3001`), mysql healthcheck + `depends_on` conditions
- [ ] Task 3: Rewrite Stage 6 `deploy` job in `.github/workflows/test.yml` (AC: 1, 2, 4)
  - [ ] 3.1 Job-level `permissions: contents: read, packages: write`; keep trigger (`github.ref == 'refs/heads/main' && github.event_name == 'push'`) and `needs: [e2e-tests]`
  - [ ] 3.2 DELETE steps: Setup Node, npm ci, `npm run build`, "Clone or update repository on VPS", "Copy frontend build to VPS" (scp of dist) — the web image builds the frontend inside Docker
  - [ ] 3.3 Build+push steps: `docker/setup-buildx-action`, `docker/login-action` (registry ghcr.io, `${{ github.actor }}` / `${{ secrets.GITHUB_TOKEN }}`), then three `docker/build-push-action` runs: api (`context: lachatadede-api`, `file: deploy/docker/Dockerfile.api`, `target: production`), web (`context: .`, `file: deploy/docker/Dockerfile.web`), engine (`context: lachatadede-engine`, `file: deploy/docker/Dockerfile.node`, `target: production`); tags per image: `ghcr.io/drayanqi/la-chatte-a-dede-2/<name>:latest` + `:sha-<short-sha>` (`${{ github.sha }}` — use the full or short sha consistently with the rollback docs)
  - [ ] 3.4 scp step: `appleboy/scp-action` ships `deploy/docker-compose.yml` + `deploy/.env.example` → `/home/debian/lachatadede/deploy/` (infra artifact only — NOT dist, NOT the repo)
  - [ ] 3.5 SSH deploy script (`appleboy/ssh-action`, envs: `GHCR_PAT, DB_PASSWORD, DB_ROOT_PASSWORD, APP_KEY`): ghcr login (`echo "$GHCR_PAT" | docker login ghcr.io -u <github-username> --password-stdin`, credsStore disable kept), one-time `.env` bootstrap from `.env.example` + secrets merge (existing sed flow, minus Docker Hub), `docker compose pull`, `docker compose up -d` (ALL FOUR services — node finally starts), mysql-ready wait (existing `mysqladmin ping` timeout loop), pre-migrate dump (`mkdir -p /home/debian/lachatadede/backups && docker compose exec -T mysql sh -c 'exec mysqldump --all-databases -uroot -p"$MYSQL_ROOT_PASSWORD"' | gzip > /home/debian/lachatadede/backups/pre-migrate-$(date +%Y%m%d-%H%M%S).sql.gz`), `php artisan migrate --force` with the existing 3-attempt retry, `config:cache` + `route:cache` (+ `view:cache` as today), health check `curl -f http://localhost/health` (nginx static 200 — upgraded to `/api/health` in 6.5), `docker compose ps`
  - [ ] 3.6 Delete `.github/workflows/deploy.yml` entirely (AC 4)
- [ ] Task 4: GitHub secrets (AC: 1, 2)
  - [ ] 4.1 Add `GHCR_PAT` (classic PAT, `read:packages`, owner = the GitHub username used in the VPS login step); document creation in `docs/ci-secrets-checklist.md` (full rewrite deferred to 6.5 — one-line note now)
  - [ ] 4.2 `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` become unused → note them for removal in the 6.5 secrets list (they can be deleted from GitHub at 6.5)
- [ ] Task 5: Deploy to production and verify (AC: 2, 5)
  - [ ] 5.1 Merge to main, watch the pipeline: lint → unit → backend → E2E (4 shards) → deploy
  - [ ] 5.2 On the box: `docker compose ps` shows 4 services Up; `curl -f http://localhost/health` OK from SSH; engine reachable (`curl -f http://localhost:3001/health` INSIDE the network — `docker compose exec laravel curl http://node:3001/health` or logs show no crash loop)
  - [ ] 5.3 From a browser: `http://venanciohugo.fr` loads the game; register a fresh user; log in; create a script + tactic and launch a **practice match** end-to-end — this exercises web→api→mysql AND api→engine→frames read-back; after it completes, `/home/debian/lachatadede/storage/simulations/` on the HOST contains the new `*.json` (proves the shared storage mount + output_path contract) and the replay plays in the UI
  - [ ] 5.4 Backups dir shows a fresh `pre-migrate-*.sql.gz` after the deploy
- [ ] Task 6: Verify rollback path (AC: 6)
  - [ ] 6.1 Document the one-command rollback in `docs/DEPLOYMENT.md` (Manual Deployment section): `ssh` → `cd /home/debian/lachatadede/deploy` → `IMAGE_TAG=sha-<previous> docker compose up -d` (pull happens because image tags change; add `docker compose pull` for safety)
  - [ ] 6.2 Dry-run it once: redeploy the current `sha-<previous>` tag and confirm services come back (no schema change involved — safe exercise)

## Verification

- Pipeline on `main`: all stages green, three GHCR packages visible under the repo's Packages (`api`, `web`, `engine`, each with `latest` + `sha-*`)
- On the VPS: 4 containers up, no crash loops, migrations applied, pre-migrate dump present, health check green in CI logs
- `http://venanciohugo.fr`: game loads, register + login through the UI works
- `grep -rn "dockerhub\|DOCKERHUB" .github/ deploy/` → zero (dead login removed)
- `deploy/docker-compose.yml` contains no `build:` keys; compose config validates (`docker compose -f deploy/docker-compose.yml config`)
- Local dev overlay still resolves: `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml config`

## Dev Notes

**Pipeline shape (decisions locked with Pelo 2026-09-20):** build in CI → GHCR → pull on VPS. Kills the current build-on-the-box design. No Docker Hub. Full app = 4 services (`web` nginx+Vite baked, `api` Laravel PHP-FPM, `engine` Node isolated-vm, `mysql`), because "current deploy scripts never start `node`" — that bug dies here. Deploy gate stays: full E2E suite green on `main` (Stage 6 of `test.yml`).

**Exact current state of Stage 6 (`test.yml` lines 337–488) — what you are replacing:**

1. checkout → setup-node → npm ci → `npm run build` (frontend in CI — replaced by Dockerfile.web stage)
2. SSH git clone/pull of `drayanqi/la-chatte-a-dede-2` on the box (dies — box needs no repo access or deploy key)
3. scp `dist/*` → `lachatadede-api/public/build` (dies — baked into web image)
4. SSH: Docker Hub login (with the `credsStore` disable hack — the hack survives, retargeted at ghcr.io), `.env` bootstrap + secrets sed-merge (KEPT, minus Docker Hub), `docker compose build laravel` (DIES), `up -d mysql` → health-wait → `up -d nginx laravel` (node NEVER started — now one `up -d` for all four), migrate retry ×3 (KEPT), config/route/view cache (KEPT), health `curl http://localhost/health` (kept for 6.3; `/api/health` in 6.5), `docker compose ps` (KEPT)

**Current compose pitfalls you must not carry over** (all verified in `deploy/docker-compose.yml`):

- `laravel` + `node` services use `build:` with `target: production` (on-box builds — AC 3 kills this)
- `nginx` mounts `../frontend-dist:/var/www/html/frontend:ro` (scp'd build) and `../lachatadede-api/public:/var/www/html/api/public:ro` + shares `laravel_vendor` named volume — all vestigial once images are self-contained
- `node` service exists but nothing ever starts it (deploy script starts only mysql → nginx+laravel)
- **Latent frames bug you must fix, not carry over (verified in code):** `GameEngineService` sends `'output_path' => storage_path('simulations')` — the LARAVEL container path `/var/www/html/storage/simulations` — and the engine writes to that literal path (`simulate.ts` does `path.join(payload.output_path, …)`), returning the same literal path which Laravel re-reads via `storage_path('simulations/'.basename($file))`. The shared dir must therefore be mounted at `/var/www/html/storage` in BOTH containers. Today's engine mount (`../lachatadede-api/storage:/app/storage`) would make the engine `mkdir` its own `/var/www/html/storage` inside the container filesystem, "succeed", and leave Laravel reading nothing — masked until now only because production never started `node`.
- MySQL has zero tuning (default buffer pool wastes the 4GB box's capacity while other services need headroom) — AC 3 fixes with command flags
- Engine image runs as `USER node` (uid 1000) and writes frames to the storage mount — the host `storage/` dir (ansible 6.2, owner debian uid 1000) must be writable by both uid 1000 (engine ✓) and www-data (laravel logs — NOT writable at 755; hence the writability note in Task 2.3)

**GHCR specifics:**

- Repo: `github.com/drayanqi/la-chatte-a-dede-2` → image namespace `ghcr.io/drayanqi/la-chatte-a-dede-2` (lowercase, slashes per package: `/api`, `/web`, `/engine`)
- CI push authenticates with the workflow's own `GITHUB_TOKEN` + `permissions: packages: write` — no PAT needed for push
- VPS pull authenticates with `GHCR_PAT` (read:packages) — a PAT scoped to the account that can see the packages; if the repo is private, the PAT's user needs package read
- First push of each package: visibility defaults to private (same repo) — fine; verify the pull works from the box before declaring victory
- `sha-<sha>`: use `${{ github.sha }}` (full 40-char) in tags; document in DEPLOYMENT.md that `IMAGE_TAG` takes the full sha shown in the Actions run

**Dockerfile.web notes:**

- Root `npm run build` = `tsc -b && vite build` (needs the repo-root tsconfigs + `src/` + `index.html` + `public/`) — the build stage must copy those; with a tight root `.dockerignore`, `COPY . .` is acceptable and simple
- Vite outputs to `dist/` (default outDir, no override found in `vite.config.ts`); the app calls the API same-origin (`/api/...` — nginx conf routes it to `laravel:9000`), so no `VITE_API_URL` build args needed
- nginx conf baked at `deploy/nginx/default.conf` — it already 404s hidden files, allows `.well-known` (6.4 ACME needs it), serves SPA from `root /var/www/html/frontend` — **fix the root path when baking**: the image puts dist at `/usr/share/nginx/html` (nginx default) — either copy there and change `root`, or copy to `/var/www/html/frontend` and keep the conf byte-identical; prefer the latter (conf untouched → local.conf overlay and 6.4 diffs stay minimal)

**Rollback design (AC 6):** `IMAGE_TAG` interpolation in the compose image refs means rollback = `IMAGE_TAG=sha-<old> docker compose pull && docker compose up -d`. No rebuild, no git, no `down()` — the forward-only law (6.1) makes schema reversals "previous image + forward fix"; document exactly that.

**MySQL 4GB tuning rationale (corrected 2026-09-23 — box is 4 GB RAM + 2 GB swap, story 6.2; the original 2 GB sizing was locked before the real plan was known):** `innodb_buffer_pool_size=512M` (~13% of RAM) + `max_connections=100` leave headroom for php-fpm, the engine (isolated-vm spikes), and the OS. Still conservative — do not raise without re-checking engine memory behavior.

**Version pins:** keep `appleboy/ssh-action@v1.0.3` + `appleboy/scp-action@v0.1.7` (in use, known-working with this secrets flow); add build tooling at current stable (`docker/setup-buildx-action@v3`, `docker/login-action@v3`, `docker/build-push-action@v6`) — verify latest at implementation time; Node 24 everywhere (`.nvmrc`, CI env, Dockerfile.node base — keep `node:24-alpine` in Dockerfile.web's build stage).

### Project Structure Notes

- Created: `deploy/docker/Dockerfile.web`, root `.dockerignore`
- Modified: `deploy/docker-compose.yml`, `.github/workflows/test.yml` (Stage 6 only), `docs/DEPLOYMENT.md` (secrets note + rollback command), `docs/ci-secrets-checklist.md` (one-line GHCR_PAT note)
- Deleted: `.github/workflows/deploy.yml`
- Untouched: all `test.yml` stages 1–5, `deploy/docker-compose.local.yml` (verify it still merges), `deploy/nginx/*.conf`, Dockerfiles api/node

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.3-CI-Builds-Images-to-GHCR-VPS-Pulls-Runs-All-Four-Services] (ACs verbatim)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-6] (pipeline decision, 4 services, 4GB box mitigations, "current deploy scripts never start node")
- [Source: .github/workflows/test.yml#Stage-6] (current deploy job being replaced)
- [Source: .github/workflows/deploy.yml] (manual duplicate — delete)
- [Source: deploy/docker-compose.yml] (vestigial mounts, build: blocks, untuned mysql)
- [Source: deploy/docker/Dockerfile.api] (production target exists — reference it from build-push)
- [Source: deploy/docker/Dockerfile.node] (node:24-alpine, USER node uid 1000, storage writability note)
- [Source: deploy/nginx/default.conf] (root path, /health, .well-known allow)
- [Source: story 3.3 dev notes] (engine compose wiring, GAME_ENGINE_URL contract)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
