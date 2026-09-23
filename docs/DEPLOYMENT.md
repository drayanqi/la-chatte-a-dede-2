# Deployment Guide - La Chatte à Dédé

This guide covers deploying La Chatte à Dédé to a Debian VPS using Docker and GitHub Actions.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     VPS LITE (INFOMANIAK, GENEVA)                             │
│                     Debian 13 — reproducible via Ansible                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         DOCKER NETWORK                                  ││
│  │                        (lachatadede_net)                                ││
│  │                                                                         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  ││
│  │  │   NGINX     │  │   LARAVEL   │  │   NODE.JS   │  │    MYSQL      │  ││
│  │  │   :80       │  │   :9000     │  │   :3001     │  │    :3306      │  ││
│  │  │             │  │   (php-fpm) │  │   (engine)  │  │               │  ││
│  │  │  + Frontend │  │             │  │             │  │               │  ││
│  │  │    React    │  │  API REST   │  │  Simulation │  │  Persistence  │  ││
│  │  │    (build)  │  │  Auth       │  │  Validation │  │               │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────────┘  ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Ansible** (with the `community.general` collection) on your local machine — provisioning runs from the repo; the VPS itself is never set up by hand. Once: `ansible-galaxy collection install -r deploy/ansible/requirements.yml`
2. **Deploy SSH key pair**: `~/.ssh/id_rsa_vps` (private, stays on your machine) and its public key added at the Infomaniak console
3. **Domain**: `venanciohugo.fr` and `lachatadede.venanciohugo.fr` pointed at the VPS IP (A records)
4. **GitHub Secrets**: Configured in your repository

## GitHub Secrets Setup

Navigate to your repository: **Settings > Secrets and variables > Actions**

Create these secrets:

| Secret | Description | How to Get It                        |
|--------|-------------|--------------------------------------|
| `VPS_HOST` | VPS IP address | Get from your VPS provider dashboard |
| `VPS_USER` | SSH username | `debian`                             |
| `VPS_SSH_KEY` | Private SSH key | See "Generate the Deploy SSH Key" below |
| `DB_PASSWORD` | MySQL user password | `openssl rand -base64 32`            |
| `DB_ROOT_PASSWORD` | MySQL root password | `openssl rand -base64 32`            |
| `APP_KEY` | Laravel application key | `php artisan key:generate --show`    |

### Generate the Deploy SSH Key

On your local machine:

```bash
# Generate a new SSH key for deployment (only once)
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_rsa_vps

# Display the public key — this is what gets added at the Infomaniak console
cat ~/.ssh/id_rsa_vps.pub

# The private key (~/.ssh/id_rsa_vps) is used by Ansible and goes to GitHub Secrets as VPS_SSH_KEY
```

Add the **public key** at the Infomaniak manager (**VPS > your VPS > SSH keys**) — not into `authorized_keys` by hand.

## Initial VPS Setup (Infomaniak)

Infomaniak VPS Lite has **no provider snapshots** — the box must be rebuildable from the repo. All OS provisioning is automated by Ansible; only the console and DNS actions below are manual.

### Step 1 — Order the VPS (manual, console)

Order a **4 GB RAM Infomaniak VPS (Debian 13, Geneva)** and note the new IPv4.

### Step 2 — Attach the deploy SSH key (manual, console)

In the Infomaniak manager (**VPS > your VPS > SSH keys**), add the **public** deploy key (`~/.ssh/id_rsa_vps.pub`, see above).

Verify key auth works BEFORE provisioning — the playbook's SSH hardening depends on it:

```bash
ssh -i ~/.ssh/id_rsa_vps debian@<VPS_IP> whoami   # expect: debian
```

### Step 3 — DNS A records (manual, console)

In **Domaines > venanciohugo.fr > Zone DNS**, add two `A` records pointing at the VPS IP:

| Type | Host | Value |
|------|------|-------|
| A | `@` (apex) | `<VPS_IP>` |
| A | `lachatadede` | `<VPS_IP>` |

Check: `dig +short venanciohugo.fr` **and** `dig +short lachatadede.venanciohugo.fr` both return the IP. Infomaniak may auto-create an **AAAA** (IPv6) record alongside — keep it; the box gets the IPv6 configured and nginx will serve it from story 6.3.

### Step 4 — Provision with Ansible (automated)

```bash
# make sure deploy/ansible/inventory.yml holds the new IP under ansible_host
ssh-keyscan <VPS_IP> >> ~/.ssh/known_hosts   # first run only: avoids the host-key prompt
ansible-playbook -i deploy/ansible/inventory.yml deploy/ansible/playbook.yml
```

The playbook installs Docker + compose plugin, creates a 2GB swapfile, configures ufw (22/80/443 only, plus a DOCKER-USER guard so container ports can't bypass the firewall) + fail2ban (sshd jail) + unattended security upgrades, hardens SSH to key-only (password and root login disabled), and creates `/home/debian/lachatadede/` with `mysql_data/` and `storage/simulations/` (the directory stays empty — nothing is cloned or started; the app arrives with story 6.3).

It is idempotent, and re-running rebuilds the **OS layer only** — it doubles as a health check (a healthy box re-runs with `changed=0 failed=0`). Data under `/home/debian/lachatadede/` (`mysql_data/`, `storage/`) and compose volumes **survive re-runs**: a re-run is not an incident-recovery wipe. For full recovery, recreate the VPS from the Infomaniak console and start over.

> **New IP?** Update **both** `ansible_host` in `deploy/ansible/inventory.yml` **and** the `VPS_HOST` GitHub Secret (**Settings > Secrets and variables > Actions**) — CI deploys read the secret, not the inventory.

### Step 5 — Verify the box

```bash
ssh -i ~/.ssh/id_rsa_vps debian@<VPS_IP>
docker run --rm hello-world                # docker group active on a fresh login
sudo swapon --show                         # /swapfile, 2G
sudo ufw status                            # exactly 22, 80, 443
sudo fail2ban-client status sshd           # sshd jail active
sudo sshd -T | grep passwordauthentication # expect: passwordauthentication no
```

Before the app exists, nothing listens on 80/443 — this is correct:

```bash
curl -I http://venanciohugo.fr
# expect: Connection refused (fast) or an HTTP error — NEVER a timeout.
# A timeout means DNS or the edge firewall is wrong.
```

> **Infomaniak gotcha:** if TCP 22 is reachable from the internet but 80/443 **time out** while the box's own `ufw status` allows them, a managed **Firewall** is attached to the VPS in the Infomaniak manager. Either remove it or add allow rules for TCP 80 and 443 (keep 22). This is invisible from inside the box.

TLS arrives with story 6.4.

## Automatic Deployments

Once GitHub Secrets are configured, deployments happen automatically:

1. Push to `main` branch
2. Tests run (lint, unit, E2E)
3. If tests pass, deploy workflow triggers
4. Frontend builds in CI
5. Code deploys to VPS via SSH
6. Docker images rebuild
7. Laravel migrations run
8. Health check verifies deployment

## Manual Deployment

If you need to deploy manually:

```bash
ssh vps_deploy
cd /home/debian/lachatadede

# Pull latest code
git pull origin main

# Build and start containers
cd deploy
docker compose build
docker compose up -d nginx laravel mysql  # Skip node until Epic 3

# Run migrations
docker compose exec laravel php artisan migrate --force

# Clear caches
docker compose exec laravel php artisan config:cache
docker compose exec laravel php artisan route:cache
```

## Useful Commands

```bash
# View logs
docker compose -f deploy/docker-compose.yml logs -f
docker compose -f deploy/docker-compose.yml logs -f laravel

# Restart a service
docker compose -f deploy/docker-compose.yml restart laravel

# Enter a container
docker compose -f deploy/docker-compose.yml exec laravel bash
docker compose -f deploy/docker-compose.yml exec mysql mysql -u root -p

# Check service status
docker compose -f deploy/docker-compose.yml ps

# Stop all services
docker compose -f deploy/docker-compose.yml down

# Rebuild and restart
docker compose -f deploy/docker-compose.yml up -d --build
```

## Troubleshooting

### Deployment fails with "Permission denied"

- Verify SSH key is correctly added to GitHub Secrets
- Ensure public key is in VPS `~/.ssh/authorized_keys`
- Check file permissions: `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`

### 502 Bad Gateway

- Laravel container might not be running: `docker compose ps`
- Check Laravel logs: `docker compose logs laravel`
- Verify PHP-FPM is listening on port 9000

### Database connection refused

- MySQL might still be starting up (can take 30-60s first time)
- Check MySQL logs: `docker compose logs mysql`
- Verify credentials match between Laravel and MySQL containers

### Frontend not loading

- Check if build files exist in `lachatadede-api/public/build/`
- Verify nginx config is serving from correct path
- Check nginx logs: `docker compose logs nginx`

### Tests pass but deploy fails

- Check GitHub Actions logs for specific error
- Verify all GitHub Secrets are set correctly
- Try manual deployment to isolate the issue

## Security Notes

Hardening status, kept current with the provisioning playbook:

- [x] Firewall (ufw): deny incoming by default, allow only 22/80/443 (story 6.2)
- [x] fail2ban protecting sshd (story 6.2)
- [x] SSH key-only auth; password + root login disabled (story 6.2)
- [ ] SSL/HTTPS with Let's Encrypt (story 6.4)
- [ ] Automated database backups (story 6.5)

## File Structure

```
deploy/
├── docker/
│   ├── Dockerfile.api      # Laravel PHP-FPM image
│   └── Dockerfile.node     # Node.js placeholder (Epic 3)
├── nginx/
│   └── default.conf        # Nginx server configuration
├── ansible/
│   ├── inventory.yml       # VPS host configuration
│   └── playbook.yml        # Initial setup playbook
├── docker-compose.yml      # Production compose file
└── .env.example            # Environment template

.github/workflows/
├── test.yml                # CI: lint, unit, E2E tests
└── deploy.yml              # CD: deployment pipeline
```
