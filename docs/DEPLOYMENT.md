# Deployment Guide — La Chatte à Dédé

The operator's entry point: what exists on the box, how it deploys, how to roll back, how to restore, where the logs are. Every command here is meant to be run as-is — if a section can't be executed from this doc alone, that's a bug in the doc.

## Architecture (the real box)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           INFOMANIAK VPS LITE — 4 GB RAM, Debian 13, Geneva (+2GB swap)     │
│           /home/debian/lachatadede/                                         │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    DOCKER NETWORK (lachatadede_net)                   │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │    WEB      │  │     API     │  │   ENGINE    │  │    MYSQL    │  │  │
│  │  │  ghcr.io/…/ │  │  ghcr.io/…/ │  │  ghcr.io/…/ │  │  mysql:8.0  │  │  │
│  │  │  web        │  │  api        │  │  engine     │  │             │  │  │
│  │  │  nginx      │  │  php-fpm    │  │  node :3001 │  │  :3306      │  │  │
│  │  │  :80/:443   │  │  :9000      │  │  /simulate  │  │  mysql_data │  │  │
│  │  │  SPA+TLS    │  │  Laravel    │  │  validation │  │  volume     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Host: certbot (TLS issuance/renewal), ufw + fail2ban, 2GB swapfile,        │
│  unattended security upgrades, backups/ (mysqldump, keep-7)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Images** (built in CI, pulled on the box — the VPS never builds): `ghcr.io/drayanqi/la-chatte-a-dede-2/{web,api,engine}`, each tagged `latest` + `sha-<commit-sha>`; MySQL is stock `mysql:8.0`.
- **MySQL tuning** for the 4 GB box: `--innodb-buffer-pool-size=512M --max-connections=100` — headroom is left for php-fpm and the engine (isolated-vm spikes). Do not raise without re-checking engine memory.
- **Host mounts**: `storage/` (bind-mounted into BOTH api and engine at `/var/www/html/storage` — the engine writes match frames to the literal `output_path` Laravel sends), `mysql_data` (named volume), `certbot/www` + `/etc/letsencrypt` (read-only TLS material in the web container), `backups/` (dump files, host-only).
- **No provider snapshots**: Infomaniak VPS Lite has none — the nightly dumps (below) are the data undo, the Ansible playbook is the OS undo, and previous image tags are the app undo.

## Prerequisites

1. **Ansible** (with the `community.general` collection) on your local machine — provisioning runs from the repo; the VPS itself is never set up by hand. Once: `ansible-galaxy collection install -r deploy/ansible/requirements.yml`
2. **Deploy SSH key pair**: `~/.ssh/id_rsa_vps` (private, stays on your machine); its public key added at the Infomaniak console (below)
3. **Domain**: `venanciohugo.fr` and `lachatadede.venanciohugo.fr` pointed at the VPS IP (A records)
4. **GitHub Secrets**: the seven in [ci-secrets-checklist.md](ci-secrets-checklist.md)

## CI Secrets

The full, current list lives in [ci-secrets-checklist.md](ci-secrets-checklist.md): `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `APP_KEY`, `GHCR_PAT`. The CI image push uses the workflow's own `GITHUB_TOKEN` (`packages: write`) — not a repository secret.

## Provisioning (one-time)

1. **Order the VPS** (manual, console): Infomaniak VPS Lite, 4 GB RAM, Debian 13, Geneva. Note the IPv4.
2. **Attach the deploy SSH key** (manual, console): Infomaniak manager → **VPS > your VPS > SSH keys** → add `~/.ssh/id_rsa_vps.pub`. Verify key auth **before** provisioning — SSH hardening depends on it:

   ```bash
   ssh -i ~/.ssh/id_rsa_vps debian@<VPS_IP> whoami   # expect: debian
   ```

3. **DNS A records** (manual, console): `@` and `lachatadede` → VPS IP. Check with `dig +short` on both names. Keep any auto-created AAAA record.
4. **Provision** (automated, idempotent — safe to re-run):

   ```bash
   ssh-keyscan <VPS_IP> >> ~/.ssh/known_hosts   # first run only
   ansible-playbook -i deploy/ansible/inventory.yml deploy/ansible/playbook.yml
   ```

   The playbook installs Docker + compose plugin, creates the 2GB swapfile, configures ufw (22/80/443 only, plus a DOCKER-USER guard so container ports can't bypass the firewall) + fail2ban (sshd jail) + unattended security upgrades, hardens SSH to key-only, creates `/home/debian/lachatadede/` (`mysql_data/`, `storage/`, `certbot/www/`, `backups/`) and schedules the nightly backup (below). A healthy box re-runs with `changed=0 failed=0`; data survives re-runs — it is NOT an incident-recovery wipe. Full recovery = recreate the VPS from the console and start over.

   > **New IP?** Update **both** `ansible_host` in `deploy/ansible/inventory.yml` and the `VPS_HOST` GitHub Secret — CI deploys read the secret, not the inventory.

5. **Verify the box**:

   ```bash
   ssh -i ~/.ssh/id_rsa_vps debian@<VPS_IP>
   docker run --rm hello-world                # docker group active on a fresh login
   sudo swapon --show                         # /swapfile, 2G
   sudo ufw status                            # exactly 22, 80, 443
   sudo fail2ban-client status sshd           # sshd jail active
   sudo sshd -T | grep passwordauthentication # expect: passwordauthentication no
   crontab -l -u debian                       # nightly database backup entry
   ```

   > **Infomaniak gotcha:** if TCP 22 is reachable but 80/443 **time out** while the box's `ufw status` allows them, a managed **Firewall** is attached to the VPS in the Infomaniak manager. Remove it or allow TCP 80/443 (keep 22). Invisible from inside the box.

## TLS (Let's Encrypt, host certbot + webroot)

Certbot runs on the HOST (the apt package ships the renewal systemd timer, twice daily); nginx serves the ACME challenges through the `certbot/www` bind mount. Renewals reload nginx automatically via the deploy hook the playbook installs (`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`).

1. **Bootstrap**: the nginx config serves TLS on 443, which fails to start without certificate files. Before the first cert exists, drop a throwaway pair in place (or start with a self-signed cert), bring the stack up, then issue:

   ```bash
   ssh -i ~/.ssh/id_rsa_vps debian@<VPS_IP>
   cd /home/debian/lachatadede/deploy
   # one-time placeholder so nginx can start (overwrite-safe):
   sudo mkdir -p /etc/letsencrypt/live/venanciohugo.fr
   sudo openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
     -keyout /etc/letsencrypt/live/venanciohugo.fr/privkey.pem \
     -out /etc/letsencrypt/live/venanciohugo.fr/fullchain.pem \
     -subj "/CN=venanciohugo.fr"
   docker compose up -d
   ```

2. **Issue the real certificate** (webroot — challenges served by the running nginx):

   ```bash
   sudo certbot certonly --webroot -w /home/debian/lachatadede/certbot/www \
     -d venanciohugo.fr -d lachatadede.venanciohugo.fr \
     --email <your-email> --agree-tos --no-eff-email
   sudo docker compose -f /home/debian/lachatadede/deploy/docker-compose.yml exec -T nginx nginx -s reload
   ```

3. **Verify renewals** (the timer is installed with the package):

   ```bash
   sudo certbot renew --dry-run
   systemctl list-timers | grep certbot   # twice daily
   ```

Port 80 answers ONLY ACME challenges and `/api/health` (see below) — everything else 301s to HTTPS.

## Automatic Deployments

Every push to `main` (gated on the full test suite being green):

1. CI runs lint, unit, backend, and the E2E suite (4 shards)
2. Stage 6 builds the three images and pushes them to GHCR (`latest` + `sha-<full-sha>`)
3. `deploy/docker-compose.yml`, `deploy/backup.sh` and `deploy/.env.example` are scp'd to `/home/debian/lachatadede/deploy/` — the only artifacts that travel; the VPS holds no repo checkout
4. The VPS logs into ghcr.io (`GHCR_PAT`), `docker compose pull`, `up -d` **all four services**, waits for the MySQL healthcheck
5. **Pre-migrate backup**: `./backup.sh` dumps all databases into `backups/` (same script the cron runs — one mechanism, one retention rule)
6. `php artisan migrate --force` (3 attempts), then config/route/view caches
7. **Health gate**: `curl -f http://localhost/api/health` — hits the Laravel route which executes `select 1` against MySQL. This is why the gate is honest: nginx's old static `/health` stayed 200 even with a dead database; `/api/health` 500s and fails the deploy. Over plain HTTP inside the box the nginx port-80 config has an exact-match exception for `/api/health` (no 301 — `curl -f` treats a 301 as success, which would make the gate check nothing).

Deploy logs show the `backup.sh` output and the health-check verdict.

## Backups & Restore

### Layout and retention

- One directory: `/home/debian/lachatadede/backups/`
- Two producers, one script: the **nightly cron** (03:30, user `debian`) and the **pre-migrate step** of every deploy both call `deploy/backup.sh` — logs from cron land in `backups/cron.log`
- One retention rule: keep the **7 newest `*.sql.gz`** in the directory regardless of prefix. Frequent deploy days may prune older nightly dumps — acceptable at this scale; the 7 kept files still span multiple days
- Dumps are complete (`--all-databases`, `--single-transaction` — consistent InnoDB snapshot without locking; the app stays up) and land under a `.part` name first, renamed only after the pipeline succeeded and the file is non-empty — a failed dump can never occupy a retention slot
- **On-box only** (explicit scope): there is no off-box sync yet — the box has no provider snapshots, which is what makes these dumps critical. Copying `backups/` off the VPS (rclone to a bucket, or a plain scp cron) is the top future hardening item.

Run it by hand any time:

```bash
ssh -i ~/.ssh/id_rsa_vps debian@<VPS_IP>
cd /home/debian/lachatadede/deploy && ./backup.sh
ls -lht ../backups | head     # newest dump on top
```

### Restore drill (copy-pasteable)

Restore the newest dump into a scratch database and verify, then drop it. Run this after setting up backups — and after any suspicious change — so the procedure stays proven:

```bash
ssh -i ~/.ssh/id_rsa_vps debian@<VPS_IP>
cd /home/debian/lachatadede/deploy

# 1. Create the scratch database
docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
  -e "CREATE DATABASE restore_drill"

# 2. Restore the newest dump into it
gunzip < ../backups/$(ls -1t ../backups/*.sql.gz | head -1 | xargs basename) \
  | docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" restore_drill

# 3. Sanity-verify: table count and row counts look like the real schema
docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" restore_drill \
  -e "SHOW TABLES"
docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" restore_drill \
  -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM matches;"

# 4. Drop the scratch database
docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
  -e "DROP DATABASE restore_drill"
```

Expected: the table list matches the live schema and the row counts are in the right ballpark (never 0 on an active box). For a real incident restore, replace `restore_drill` with the live database name **after** stopping the api/engine containers (`docker compose stop laravel node`) so nothing writes mid-restore; bring them back up afterwards.

## Rollback

A bad release rolls back with one command — redeploy the previous `sha-*` image tags (no rebuild, no git; per the forward-only migration law there is no `down()`: schema recovery is "previous image + forward fix", and if a migration broke data, restore last night's dump per the drill above):

```bash
ssh -i ~/.ssh/id_rsa_vps debian@<VPS_IP>
cd /home/debian/lachatadede/deploy

# <sha> = full commit sha of the last good run (GitHub Actions run page,
# or the package's tag list on ghcr.io — tags look like sha-<40 chars>)
IMAGE_TAG=sha-<previous> docker compose pull && IMAGE_TAG=sha-<previous> docker compose up -d
```

`IMAGE_TAG` pins all three app images to that build; `docker compose pull` makes the rollback explicit. `latest` always tracks the newest green build of `main`.

## Useful Commands

```bash
cd /home/debian/lachatadede/deploy

docker compose logs -f                # everything
docker compose logs -f laravel        # API only
docker compose ps                     # service status
docker compose exec laravel bash      # into the API container
docker compose exec mysql mysql -u root -p
docker compose restart laravel        # restart one service
docker compose down                   # stop everything (data volumes survive)
./backup.sh                           # manual backup
curl -f http://localhost/api/health   # honest health check (PHP -> MySQL)
```

## Troubleshooting

### Deploy fails at the health check

- `docker compose logs laravel mysql` — the route 500s when MySQL is unreachable; fix the database first, the gate is doing its job
- Confirm from the box that plain HTTP reaches the API without redirecting: `curl -sI http://localhost/api/health | head -1` must be `HTTP/1.1 200`

### 502 Bad Gateway

- `docker compose ps` — is the laravel container up? `docker compose logs laravel`; php-fpm listens on 9000

### Database connection refused

- MySQL can take 30–60s on first start; `docker compose logs mysql`
- Verify credentials match between the laravel and mysql containers (`.env`)

### Deploy fails with "Permission denied"

- SSH key in GitHub Secrets (`VPS_SSH_KEY`) and at the Infomaniak console
- Box-side: `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`
- Remember fail2ban: 5 failed attempts in 10 minutes = 1h ban

### Tests pass but deploy fails

- GitHub Actions logs name the step; the preflight `nc` step distinguishes a wrong `VPS_HOST` secret (unmasked address) from a network/firewall problem (masked `***`)

## Security Notes

Hardening status, kept current with the provisioning playbook:

- [x] Firewall (ufw): deny incoming by default, allow only 22/80/443, DOCKER-USER guard (story 6.2)
- [x] fail2ban protecting sshd (story 6.2)
- [x] SSH key-only auth; password + root login disabled (story 6.2)
- [x] TLS with Let's Encrypt: webroot issuance, auto-renewal timer + nginx reload hook (story 6.4)
- [x] Automated database backups: nightly 03:30 cron + pre-migrate, keep-7 retention (story 6.5)

## File Structure

```
deploy/
├── docker/
│   ├── Dockerfile.api      # Laravel PHP-FPM image (built in CI)
│   ├── Dockerfile.node     # Node.js game engine image (built in CI)
│   └── Dockerfile.web      # Frontend + nginx image (built in CI)
├── nginx/
│   └── default.conf        # Nginx server configuration (baked into the web image)
├── ansible/
│   ├── inventory.yml       # VPS host configuration
│   └── playbook.yml        # OS provisioning (idempotent) + backup cron
├── backup.sh               # All-database dump + keep-7 retention (cron + pre-migrate)
├── docker-compose.yml      # Production compose file (pulls GHCR images)
└── .env.example            # Environment template

.github/workflows/
└── test.yml                # CI: lint, unit, backend, E2E + deploy (build → GHCR → VPS)
```
