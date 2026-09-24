# CI Secrets Checklist

Seven repository secrets power the deploy pipeline (lint/test/E2E run without any of them — they gate only the deploy job). Set them under **Settings → Secrets and variables → Actions → Repository secrets** (or `gh secret set NAME --body "…"`).

> **Removed with story 6.5:** `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` — images moved to GHCR in story 6.3. Delete them if they are still defined.

## Required Secrets

| Secret | Value | Used by |
|--------|-------|---------|
| `VPS_HOST` | Raw VPS IPv4 (e.g. `84.20.XX.XX`) — no `ssh://`, no port suffix | Preflight `nc` probe + ssh/scp deploy steps |
| `VPS_USER` | `debian` | ssh/scp deploy steps |
| `VPS_SSH_KEY` | **Full PEM private key** (`~/.ssh/id_rsa_vps`) — `-----BEGIN OPENSSH PRIVATE KEY-----` through `-----END…`, newlines included | ssh/scp deploy steps |
| `DB_PASSWORD` | Laravel DB user password (any strong string) | Written to VPS `.env` (`DB_PASSWORD`, `MYSQL_PASSWORD`) |
| `DB_ROOT_PASSWORD` | MySQL **root** password (any strong string) | Written to VPS `.env` (`MYSQL_ROOT_PASSWORD`) — used by `backup.sh` and the restore drill |
| `APP_KEY` | Laravel key — `base64:…`, generated once (see below) | Written to VPS `.env` (`APP_KEY`) |
| `GHCR_PAT` | Classic PAT of the `drayanqi` account, **read:packages** scope | VPS-side `docker login ghcr.io` |

Notes:

- **CI image push needs no PAT** — the workflow's own `GITHUB_TOKEN` with `packages: write` pushes to GHCR. `GHCR_PAT` is only the VPS pull credential.
- **Never rotate `APP_KEY` casually**: it encrypts sessions and other encrypted-at-rest values; rotating logs everyone out and can corrupt unreadable data. Generate once, keep it stable.
- Secrets are shared across the whole repository (no GitHub Environments) — the deploy job is the only consumer today.

## Generating the one-time values

```bash
# APP_KEY (run once, from the api repo — reuse the SAME value forever):
php artisan key:generate --show          # → base64:…

# VPS_SSH_KEY (deploy keypair — private half goes into the secret,
# public half is attached to the VPS in the Infomaniak console):
ssh-keygen -t ed25519 -f ~/.ssh/id_rsa_vps -C "lachatadede-deploy"
cat ~/.ssh/id_rsa_vps                    # paste entire contents into VPS_SSH_KEY

# GHCR_PAT: github.com → Settings → Developer settings →
# Personal access tokens (classic) → Generate (read:packages only)
```

## Setup Order

1. Provision keypair + PAT (commands above)
2. Order the VPS, attach the deploy public key, note the IPv4 ([DEPLOYMENT.md](DEPLOYMENT.md) § Provisioning)
3. Set the seven secrets in GitHub (table above)
4. Push to `main` — the preflight step validates `VPS_HOST` reachability before anything is shipped

## Verifying the setup

- **`VPS_HOST`**: the preflight `nc -zv` prints the dialed address — GitHub masks every occurrence of a secret's *value* in logs, so **masked `***` = secret is the real address; unmasked = the secret is wrong** (it's dialing a black hole)
- **`VPS_SSH_KEY` / `VPS_USER`**: scp/ssh steps fail with `Permission denied (publickey)` → key missing newline/footer, wrong user, or the public half isn't attached on the VPS
- **`GHCR_PAT`**: deploy log shows `Login Succeeded` at the ghcr.io step; a 403 → expired/insufficient scope
- **`DB_*` / `APP_KEY`**: not exercised until the VPS-side script runs — a wrong `APP_KEY` (missing `base64:` prefix) crashes Laravel at first request and the health check fails the deploy

## Rotation

Rotate `GHCR_PAT` and `DB_PASSWORD`/`DB_ROOT_PASSWORD` on any suspicion of leakage, and `GHCR_PAT` at expiry. `DB_*` changes take effect on the next deploy but must be applied to the running MySQL first (`ALTER USER`), or the health check fails mid-deploy. `APP_KEY`: do not rotate (see note above). If a private key leaks: generate a new pair, update `VPS_SSH_KEY` and the console-attached public key, remove the old one.

## Security Best Practices

1. **Never commit secrets** — GitHub Secrets only; the repo's `.env*` files are templates/placeholders
2. **Minimal scope** — `GHCR_PAT` is read:packages only, never repo-wide
3. **No debug output** — never `echo` secret values; GitHub masks them, but rely on that only by accident, not by design
4. **Fork PRs get no secrets** — by design; the deploy job can only be triggered by pushes to `main`
