---
baseline_commit: a4bf3f89a8dac6bb9aee6239155645138f1f2cd3
---

# Story 6.2: VPS Ordered & Provisioned (Ansible)

Status: ready-for-dev

## Story

As the operator,
I want the fresh Infomaniak VPS hardened and reproducible from the repo via Ansible,
So that the deploy target is secure, tuned for 2GB, and rebuildable from scratch.

## Acceptance Criteria

1. **Given** Pelo ordered the VPS Lite 2GB (Debian 12, Geneva) and added a deploy SSH key at the Infomaniak console, **When** `ansible-playbook -i deploy/ansible/inventory.yml deploy/ansible/playbook.yml` runs against the new IP, **Then** it completes without errors.
2. **Given** the playbook has run, **When** the box is inspected, **Then** Docker + compose plugin are installed and usable by the `debian` user **And** a 2GB swapfile is active **And** ufw allows only 22/80/443 and fail2ban protects sshd **And** SSH accepts key auth only (password + root login disabled).
3. **Given** `deploy/ansible/inventory.yml`, **When** reviewed, **Then** it holds the new VPS IP and the ghost `83.228.196.103` is gone.
4. **Given** the DNS A record for `venanciohugo.fr` points at the new IP, **When** the box is probed before the app exists, **Then** it is reachable (TLS arrives with 6.4).
5. **Given** the manual ordering steps, **When** documented, **Then** `docs/DEPLOYMENT.md` lists them (order, SSH key, DNS, secrets) so a fresh box is reproducible.

## Scope Boundary (read first)

- This story provisions the OS: Docker, swap, firewall, fail2ban, SSH, directories. It does NOT deploy the app (6.3), does NOT install certbot/HTTPS (6.4), does NOT set up backups (6.5).
- The app directory is created but stays EMPTY (no git clone, no compose up). The current git-based clone flow in test.yml dies in 6.3.
- Port 443 must be open in ufw now even though nothing serves TLS yet (6.4 needs it without another ansible run).
- SSH hardening is the riskiest task: verify the deploy key works BEFORE enabling key-only auth, and keep the Infomaniak console/KVM as the recovery path. Do not disable root login before confirming password auth is no longer needed.
- ufw must allow 22 (OpenSSH) BEFORE `ufw enable`, or the box is locked out.
- Manual steps Pelo does outside the repo (order the VPS, add SSH key at the console, set DNS A record, get the new IP) are prerequisites — the story documents them in DEPLOYMENT.md and records the IP in inventory.yml.

## Tasks / Subtasks

- [ ] Task 1: Update `deploy/ansible/inventory.yml` (AC: 3)
  - [ ] 1.1 Replace `ansible_host: 83.228.196.103` with the new VPS IP from Pelo
  - [ ] 1.2 Keep `ansible_user: debian` (Infomaniak's default user) and `ansible_python_interpreter: /usr/bin/python3`
- [ ] Task 2: Extend `deploy/ansible/playbook.yml` — keep existing Docker tasks (AC: 1, 2)
  - [ ] 2.1 Existing tasks stay: apt prerequisites, Docker GPG keyring install (docker-ce, docker-ce-cli, containerd.io, docker-compose-plugin), docker service enabled, `debian` added to docker group, app dirs `/home/debian/lachatadede` + `mysql_data/` + `storage/simulations/`
  - [ ] 2.2 The "Install Git" task becomes unnecessary for the registry-based pipeline (nothing is cloned on the VPS anymore) — remove it or keep only if the runbook wants git present for debugging; prefer removal
- [ ] Task 3: Add 2GB swapfile task (AC: 2)
  - [ ] 3.1 Create `/swapfile` (2G, mode 0600), mkswap, swapon, persist via `/etc/fstab` (idempotent: check `ansible_swaptotal_mb` first)
- [ ] Task 4: Add ufw + fail2ban tasks (AC: 2)
  - [ ] 4.1 Install ufw; default deny incoming / allow outgoing; allow 22, 80, 443; `ufw enable` (only after rules — task order matters)
  - [ ] 4.2 Install fail2ban; drop a local jail config (`/etc/fail2ban/jail.local`) enabling sshd with sane defaults (bantime/findtime/maxretry); enable + start service
- [ ] Task 5: Add SSH hardening task (AC: 2)
  - [ ] 5.1 Drop-in config `/etc/ssh/sshd_config.d/99-hardening.conf`: `PasswordAuthentication no`, `PermitRootLogin no`, `PubkeyAuthentication yes` (keep KbdInteractiveAuthentication no); validate config with `sshd -t` before restarting sshd; do NOT close the current session before a second connection test succeeds
  - [ ] 5.2 Verify Pelo's deploy key (added at the Infomaniak console) authenticates: `ssh debian@<IP>` from the local machine BEFORE the hardening task runs
- [ ] Task 6: Run the playbook against the new box and verify (AC: 1, 2, 4)
  - [ ] 6.1 `ansible-playbook -i deploy/ansible/inventory.yml deploy/ansible/playbook.yml` → completes without errors (idempotent re-run also clean)
  - [ ] 6.2 Post-checks: `docker run hello-world` as debian; `swapon --show` shows 2G; `ufw status` shows exactly 22/80/443; `fail2ban-client status sshd` responds; `ssh -o PasswordAuthentication=yes debian@<IP>` is refused
- [ ] Task 7: DNS + reachability (AC: 4)
  - [ ] 7.1 Pelo sets the A record `venanciohugo.fr` → new IP (documented in Task 8)
  - [ ] 7.2 `dig +short venanciohugo.fr` returns the IP; `curl -I http://venanciohugo.fr` connects (expect connection refused/404, NOT a timeout — port reachable)
- [ ] Task 8: Document manual steps in `docs/DEPLOYMENT.md` (AC: 5)
  - [ ] 8.1 Rewrite the "Initial VPS Setup" section for the Infomaniak flow: order VPS Lite 2GB Debian 12 (Geneva), add deploy SSH public key at the console, note the new IP, set DNS A record, GitHub secrets list
  - [ ] 8.2 Remove stale content: 4GB/80GB specs, `git clone`-based manual deploy, Docker Hub references (the full doc rewrite to match deployed reality happens in 6.5 — here only the provisioning story becomes true)

## Verification

- Playbook runs green twice (second run = idempotency check)
- Manual checklist from Task 6 all pass on the real box
- `ssh` with key works; password auth refused; root refused
- `venanciohugo.fr` resolves and the box answers on port 80 (nothing serving yet — connection accepted, no HTTP 200 required)

## Dev Notes

**Why this story exists (Epic 6, decisions locked 2026-09-20):** the old VPS is ghosted (`83.228.196.103` — a 4GB box assumption baked into old docs). Pelo ordered a **VPS Lite 2GB (Debian 12, Geneva)** with a fresh IP. All 2GB mitigations ship across the epic; this story owns the OS-level ones (swap, tuned firewall; MySQL tuning + registry-based deploys arrive in 6.3, dumps in 6.5). VPS Lite has **no provider snapshots** — the box must be rebuildable from this playbook, hence "reproducible from the repo".

**Current state of the files you will touch (read them before editing):**

- `deploy/ansible/inventory.yml` (13 lines): single host `vps`, ghost IP `83.228.196.103`, user `debian`, python3 interpreter, `production` group.
- `deploy/ansible/playbook.yml` (124 lines): `become: true`, `vars: app_user: debian, app_path: /home/debian/lachatadede`, modern Docker install (GPG key at `/etc/apt/keyrings/docker.asc`, repo for `{{ ansible_distribution_release }}`), docker group, app dirs, git install, restart-docker handler. **All of that stays valid for the new box** — you are ADDING swap/ufw/fail2ban/ssh-hardening sections, not rewriting Docker.
- `docs/DEPLOYMENT.md` (234 lines): describes the OLD world (4GB, `git clone` on box, Docker Hub, manual scp deploy). Only the provisioning part is corrected in this story; the pipeline/backups sections get their 6.3/6.5 rewrites.

**Ansible specifics that prevent common failures:**

- Swap idempotency: `when: ansible_swaptotal_mb < 2048` guard, then `dd`/`fallocate` → `chmod 600` → `mkswap` → `swapon` → fstab line via `mount` module (`src=/swapfile fstype=swap opts=sw`).
- ufw: install → set policies → allow rules → enable LAST. Ansible's `community.general.ufw` or raw `ufw` command both fine; keep it simple with `ufw: rule=allow port=X proto=tcp`.
- fail2ban on Debian 12: package `fail2ban`; sshd jail enabled by default but Debian 12 needs `/etc/fail2ban/jail.local` (backend defaults changed); `fail2ban-client status sshd` as the smoke test.
- SSH drop-in: Debian 12 supports `Include /etc/ssh/sshd_config.d/*.conf` (already in the stock config). Use `notify: restart sshd` handler with `sshd -t` validation in a pre-task. NEVER set these in the main sshd_config directly.
- Docker group membership needs a re-login to take effect for the `debian` user — the playbook's `docker run hello-world` check must run via `become_user: debian` with `become: true`, or through a fresh SSH session, not by reusing the become session that installed it.

**What "reachable" means for AC 4:** before the app exists, `curl -I http://venanciohugo.fr` should fail with `Connection refused` (port open, nothing bound — nginx arrives in 6.3) or a 4xx from Infomaniak defaults — the failure must NOT be a timeout (that would mean firewall/DNS is wrong). Document the exact expected output in DEPLOYMENT.md.

### Project Structure Notes

- Modified: `deploy/ansible/inventory.yml`, `deploy/ansible/playbook.yml`, `docs/DEPLOYMENT.md` (Initial VPS Setup + Prerequisites sections only)
- Created: nothing (all files exist)
- Ansible runs from Pelo's machine; no CI integration for provisioning (one-time + rebuild tool)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.2-VPS-Ordered-and-Provisioned-Ansible] (ACs verbatim)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-6] (VPS Lite 2GB Debian 12 Geneva, 2GB mitigations list, no snapshots)
- [Source: deploy/ansible/inventory.yml] (ghost IP to replace)
- [Source: deploy/ansible/playbook.yml] (existing Docker + dirs tasks to preserve)
- [Source: docs/DEPLOYMENT.md] (outdated provisioning section to correct)
- [Source: tech-spec-docker-ansible-deployment.md#Review-Notes] (F13: modern GPG key handling already applied — keep it)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
