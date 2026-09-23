---
baseline_commit: a4bf3f89a8dac6bb9aee6239155645138f1f2cd3
---

# Story 6.4: HTTPS with Let's Encrypt

Status: ready-for-dev

## Story

As a player,
I want https://venanciohugo.fr served over a valid certificate with HTTP redirecting to HTTPS,
So that accounts and tokens never cross the wire in cleartext.

## Acceptance Criteria

1. **Given** DNS points at the VPS, **When** the certbot (webroot) issuance runs, **Then** a valid certificate for `venanciohugo.fr` is issued and mounted by nginx.
2. **Given** any HTTP request, **When** it arrives on port 80, **Then** it 301-redirects to HTTPS.
3. **Given** renewal, **When** `certbot renew --dry-run` runs, **Then** it succeeds without manual action (auto-renewal configured).
4. **Given** the app environment, **When** reviewed, **Then** `APP_URL=https://venanciohugo.fr` and Laravel cookies are secure-flagged over HTTPS.

## Scope Boundary (read first)

- **Chicken-and-egg:** nginx refuses to start with a 443 server block whose cert files don't exist. The conf ships in the web image (6.3 decision), so this story deploys **twice**: phase A = HTTP conf + ACME webroot location (cert can be issued), phase B = 301 redirect + 443 TLS server (cert now exists). Both phases are commits inside this story; the deploy pipeline is already automatic.
- certbot runs on the **host** (apt package + its systemd timer), NOT as a container. Webroot is a host dir bind-mounted into the nginx container. Renewal reload = `docker compose exec nginx nginx -s reload` via a deploy hook.
- Ports 80/443 are already open in ufw (6.2). Nothing new at the firewall.
- The API auth uses Sanctum **Bearer tokens** (Authorization header), not cookies — secure-flagging matters for the session cookie; do not rework auth.
- Full DEPLOYMENT.md rewrite stays with 6.5; here only the HTTPS section becomes true.

## Tasks / Subtasks

- [ ] Task 1: Compose — give nginx TLS plumbing (AC: 1)
  - [ ] 1.1 `deploy/docker-compose.yml` nginx service: add `"443:443"` port mapping; add volumes `/home/debian/lachatadede/certbot/www:/var/www/html/certbot:ro` and `/etc/letsencrypt:/etc/letsencrypt:ro` (RO — renewal happens on the host; nginx only reads)
  - [ ] 1.2 Create host dirs in the playbook (Task 3): `/home/debian/lachatadede/certbot/www` (mode 0755)
- [ ] Task 2: Phase A — deploy an ACME-ready HTTP conf (AC: 1)
  - [ ] 2.1 `deploy/nginx/default.conf`: keep the existing server (port 80, SPA + `/api/` fastcgi + `/health`) and ADD before the SPA location: `location ^~ /.well-known/acme-challenge/ { root /var/www/html/certbot; default_type "text/plain"; try_files $uri =404; }` (the existing `~ /\.(?!well-known)` deny already permits this path)
  - [ ] 2.2 Merge → CI builds new web image → auto-deploy (Stage 6) → confirm the conf landed (`curl http://venanciohugo.fr/.well-known/acme-challenge/test` returns 404, not index.html)
- [ ] Task 3: Playbook — install certbot on the host (AC: 1, 3)
  - [ ] 3.1 `deploy/ansible/playbook.yml`: `apt: name=certbot` task (after existing Docker section)
  - [ ] 3.2 Renewal deploy hook `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` (mode 0755): `#!/bin/sh\ndocker compose -f /home/debian/lachatadede/deploy/docker-compose.yml exec -T nginx nginx -s reload` — certbot's timer (installed with the apt package, runs twice daily) triggers it on every successful renewal
- [ ] Task 4: Issue the certificate (AC: 1)
  - [ ] 4.1 On the box: `certbot certonly --webroot -w /home/debian/lachatadede/certbot/www -d venanciohugo.fr --email <pelo@…> --agree-tos --no-eff-email --non-interactive`
  - [ ] 4.2 Verify files exist: `/etc/letsencrypt/live/venanciohugo.fr/fullchain.pem` + `privkey.pem`
- [ ] Task 5: Phase B — TLS server + HTTP→HTTPS redirect (AC: 2)
  - [ ] 5.1 `deploy/nginx/default.conf`: port-80 server becomes redirect-only EXCEPT the ACME location (renewals must keep working over HTTP): `location ^~ /.well-known/acme-challenge/ { … }` stays; `location / { return 301 https://$host$request_uri; }` (keep `/api/` + `/health` fastcgi blocks OUT — they're dead weight once redirecting; keep the file minimal)
  - [ ] 5.2 ADD the 443 server block: `listen 443 ssl; http2 on; server_name venanciohugo.fr;` + `ssl_certificate /etc/letsencrypt/live/venanciohugo.fr/fullchain.pem; ssl_certificate_key /etc/letsencrypt/live/venanciohugo.fr/privkey.pem;` + `ssl_protocols TLSv1.2 TLSv1.3;` + the SPA root/locations + `/api/` fastcgi block + `/health` (moved verbatim from the old port-80 server)
  - [ ] 5.3 Merge → CI deploy → `docker compose logs nginx` clean, no crash loop
- [ ] Task 6: App environment over HTTPS (AC: 4)
  - [ ] 6.1 `deploy/.env.example`: `APP_URL=https://venanciohugo.fr`, add `SESSION_SECURE_COOKIE=true` (documented value, travels with every scp for fresh-box bootstrap)
  - [ ] 6.2 On the box: update `/home/debian/lachatadede/deploy/.env` with both values; `deploy/docker-compose.yml` laravel environment: add `SESSION_SECURE_COOKIE=${SESSION_SECURE_COOKIE:-true}`; `docker compose up -d laravel` (recreates with new env)
  - [ ] 6.3 Note Laravel 12 default: `config/session.php` reads `SESSION_SECURE_COOKIE`; with `APP_ENV=production` the stack is already HTTPS-friendly — verify the login response's `Set-Cookie` carries `Secure` (curl -v or devtools)
- [ ] Task 7: Verify renewal (AC: 3)
  - [ ] 7.1 On the box: `certbot renew --dry-run` → success (exercises the webroot + the reload hook against the container)
- [ ] Task 8: End-to-end verification (ACs 1–4)
  - [ ] 8.1 `curl -I http://venanciohugo.fr/` → `301` + `Location: https://venanciohugo.fr/`
  - [ ] 8.2 `curl -I https://venanciohugo.fr/` → 200, valid chain (no browser warning)
  - [ ] 8.3 `https://venanciohugo.fr` loads the game; register + login through the UI over TLS; API calls stay same-origin (`/api/...` — nginx 443 block proxies them)
  - [ ] 8.4 `docs/DEPLOYMENT.md`: replace the "Security Notes (Future Tasks)" SSL checkbox with a short HTTPS section (cert paths, webroot, renew hook, the dry-run command)

## Verification

- `certbot certificates` on the box shows a valid `venanciohugo.fr` cert (not staging — real issuance, rate-limit aware: ONE issuance, use `--staging` first only if experimenting, then re-issue for real)
- `certbot renew --dry-run` green (AC 3)
- HTTP→HTTPS 301 on every path; HTTPS serves the game end-to-end (AC 2, 8.1–8.3)
- Login `Set-Cookie` includes `Secure` (AC 4)
- CI pipeline green with the new conf baked into the web image (phases A and B)

## Dev Notes

**Epic context:** HTTPS and nightly + pre-migrate DB backups are the two "in-epic" production necessities (Epic 6 implementation note). AC order mirrors the epics file. This story assumes 6.2 (box, ufw 80/443 open, playbook) and 6.3 (image pipeline, compose with ghcr images) are done.

**Why host certbot, not a certbot container:** one less container to orchestrate; Debian 13's `certbot` apt package ships with the renewal systemd timer and hook directories; webroot mode keeps nginx in the serving path (no port juggling during renewal). The reload hook is the only glue — `nginx -s reload` inside the container picks up renewed certs with zero downtime.

**The two-phase deploy, explained:** `ssl_certificate` pointing at a missing file makes nginx exit at config test → the container crash-loops → the deploy health check fails. Phase A exists solely so the ACME challenge is servable while the cert doesn't exist yet. After issuance, phase B is safe. Both conf versions live in this story's git history; there is no third conf.

**Webroot path mapping (get this right):** certbot writes challenges to `/home/debian/lachatadede/certbot/www/.well-known/acme-challenge/<token>`; nginx must serve that SAME path at `http://venanciohugo.fr/.well-known/acme-challenge/<token>`. With the bind mount `certbot/www → /var/www/html/certbot` and `root /var/www/html/certbot` in the ACME location, the paths line up exactly. If validation fails with 404, check: the bind mount exists in compose, the conf was actually baked (new image — `docker compose exec nginx grep -r acme /etc/nginx/conf.d/`), and DNS resolves to this box.

**Phase B conf details:**

- Keep the ACME location in the port-80 server (renewal happens over HTTP forever — do not redirect challenge requests)
- `http2 on;` is the nginx ≥1.25.1 syntax (nginx:alpine is well past it); `listen 443 ssl http2;` is deprecated
- Don't add HSTS this story — it's a one-way street; Pelo can opt in later
- OCSP stapling: unnecessary (Let's Encrypt ended OCSP support 2025); skip

**Cookie security:** `SESSION_SECURE_COOKIE=true` → Laravel session cookie gets `Secure`. Sanctum tokens travel in the `Authorization` header — the transport (TLS) is what protects them, which is exactly what this story delivers. `APP_URL` switching to https also fixes any generated absolute URLs (password-reset mails, etc.).

**Rate limits (don't burn them):** Let's Encrypt allows 50 certs/domain/week but 5 FAILED validations per hour/account/hostname. Always validate DNS (`dig +short venanciohugo.fr`) and the challenge path (`curl` a fake token → 404 with plain text, NOT the SPA index.html) BEFORE issuing.

### Project Structure Notes

- Modified: `deploy/docker-compose.yml` (nginx ports + volumes, laravel env), `deploy/nginx/default.conf` (phase A then phase B), `deploy/ansible/playbook.yml` (certbot + hook + webroot dir), `deploy/.env.example` (APP_URL, SESSION_SECURE_COOKIE), `docs/DEPLOYMENT.md` (HTTPS section)
- Untouched: workflows (no CI changes — conf changes ride the existing image pipeline), Dockerfile.web (bakes whatever conf is in the repo), Dockerfiles api/node
- Host state after this story: `/etc/letsencrypt/` populated, certbot.timer active, `/home/debian/lachatadede/certbot/www` present

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.4-HTTPS-with-Lets-Encrypt] (ACs verbatim)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-6] (HTTPS in-epic decision, story order 6.4 after 6.3)
- [Source: deploy/nginx/default.conf] (current conf: hidden-file deny already excludes .well-known, /health, /api/ fastcgi, SPA root)
- [Source: deploy/docker-compose.yml after 6.3] (nginx service shape, env plumbing)
- [Source: story 6.2] (ufw 22/80/443, playbook structure, certbot dir placement)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
