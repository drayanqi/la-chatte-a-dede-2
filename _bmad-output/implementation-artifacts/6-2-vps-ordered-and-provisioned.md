---
baseline_commit: a4bf3f89a8dac6bb9aee6239155645138f1f2cd3
---

# Story 6.2: VPS Ordered & Provisioned (Ansible)

Status: in-progress

> 2026-09-23: code review applied 18 fixes to the playbook/docs/story. The playbook has NOT been re-run against the box since — one idempotency re-run (`ansible-playbook -i deploy/ansible/inventory.yml deploy/ansible/playbook.yml`, expect `changed=0 failed=0`) validates the new tasks (key-auth assert, DOCKER-USER guard, ignoreip, unattended-upgrades, swap size guard, nofail, ufw limit, AllowUsers, sshd -T assertions) and closes the story.

## Story

As the operator,
I want the fresh Infomaniak VPS hardened and reproducible from the repo via Ansible,
So that the deploy target is secure, tuned for the 4 GB box, and rebuildable from scratch.

## Acceptance Criteria

1. **Given** Pelo ordered the 4 GB Infomaniak VPS (Debian 13, Geneva) and added a deploy SSH key at the Infomaniak console, **When** `ansible-playbook -i deploy/ansible/inventory.yml deploy/ansible/playbook.yml` runs against the new IP, **Then** it completes without errors.
2. **Given** the playbook has run, **When** the box is inspected, **Then** Docker + compose plugin are installed and usable by the `debian` user **And** a 2GB swapfile is active **And** ufw allows only 22/80/443 and fail2ban protects sshd **And** SSH accepts key auth only (password + root login disabled).
3. **Given** `deploy/ansible/inventory.yml`, **When** reviewed, **Then** it holds the new VPS IP and the ghost `83.228.196.103` is gone.
4. **Given** the DNS A record for `venanciohugo.fr` (and dedicated subdomain lachatadede.venanciohugo.fr) points at the new IP, **When** the box is probed before the app exists, **Then** it is reachable (TLS arrives with 6.4).
5. **Given** the manual ordering steps, **When** documented, **Then** `docs/DEPLOYMENT.md` lists them (order, SSH key, DNS, secrets) so a fresh box is reproducible.

## Scope Boundary (read first)

- This story provisions the OS: Docker, swap, firewall, fail2ban, SSH, directories. It does NOT deploy the app (6.3), does NOT install certbot/HTTPS (6.4), does NOT set up backups (6.5).
- The app directory is created but stays EMPTY (no git clone, no compose up). The current git-based clone flow in test.yml dies in 6.3.
- Port 443 must be open in ufw now even though nothing serves TLS yet (6.4 needs it without another ansible run).
- SSH hardening is the riskiest task: verify the deploy key works BEFORE enabling key-only auth, and keep the Infomaniak console/KVM as the recovery path. Do not disable root login before confirming password auth is no longer needed.
- ufw must allow 22 (OpenSSH) BEFORE `ufw enable`, or the box is locked out.
- Manual steps Pelo does outside the repo (order the VPS, add SSH key at the console, set DNS A record, get the new IP) are prerequisites — the story documents them in DEPLOYMENT.md and records the IP in inventory.yml.

## Tasks / Subtasks

- [x] Task 1: Update `deploy/ansible/inventory.yml` (AC: 3)
  - [x] 1.1 Replace `ansible_host: 83.228.196.103` with the new VPS IP from Pelo
  - [x] 1.2 Keep `ansible_user: debian` (Infomaniak's default user) and `ansible_python_interpreter: /usr/bin/python3`
- [x] Task 2: Extend `deploy/ansible/playbook.yml` — keep existing Docker tasks (AC: 1, 2)
  - [x] 2.1 Existing tasks stay: apt prerequisites, Docker GPG keyring install (docker-ce, docker-ce-cli, containerd.io, docker-compose-plugin), docker service enabled, `debian` added to docker group, app dirs `/home/debian/lachatadede` + `mysql_data/` + `storage/simulations/`
  - [x] 2.2 The "Install Git" task becomes unnecessary for the registry-based pipeline (nothing is cloned on the VPS anymore) — remove it or keep only if the runbook wants git present for debugging; prefer removal
- [x] Task 3: Add 2GB swapfile task (AC: 2)
  - [x] 3.1 Create `/swapfile` (2G, mode 0600), mkswap, swapon, persist via `/etc/fstab` (idempotent: check `ansible_swaptotal_mb` first)
- [x] Task 4: Add ufw + fail2ban tasks (AC: 2)
  - [x] 4.1 Install ufw; default deny incoming / allow outgoing; allow 22, 80, 443; `ufw enable` (only after rules — task order matters)
  - [x] 4.2 Install fail2ban; drop a local jail config (`/etc/fail2ban/jail.local`) enabling sshd with sane defaults (bantime/findtime/maxretry); enable + start service
- [x] Task 5: Add SSH hardening task (AC: 2)
  - [x] 5.1 Drop-in config `/etc/ssh/sshd_config.d/99-hardening.conf`: `PasswordAuthentication no`, `PermitRootLogin no`, `PubkeyAuthentication yes` (keep KbdInteractiveAuthentication no); validate config with `sshd -t` before restarting sshd; do NOT close the current session before a second connection test succeeds
  - [x] 5.2 Verify Pelo's deploy key (added at the Infomaniak console) authenticates: `ssh debian@<IP>` from the local machine BEFORE the hardening task runs
- [x] Task 6: Run the playbook against the new box and verify (AC: 1, 2, 4)
  - [x] 6.1 `ansible-playbook -i deploy/ansible/inventory.yml deploy/ansible/playbook.yml` → completes without errors (idempotent re-run also clean)
  - [x] 6.2 Post-checks: `docker run hello-world` as debian; `swapon --show` shows 2G; `ufw status` shows exactly 22/80/443; `fail2ban-client status sshd` responds; `ssh -o PasswordAuthentication=yes debian@<IP>` is refused
- [x] Task 7: DNS + reachability (AC: 4)
  - [x] 7.1 Pelo sets the A record `venanciohugo.fr` → new IP (documented in Task 8)
  - [x] 7.2 `dig +short venanciohugo.fr` returns the IP; `curl -I http://venanciohugo.fr` connects (expect connection refused/404, NOT a timeout — port reachable)
- [x] Task 8: Document manual steps in `docs/DEPLOYMENT.md` (AC: 5)
  - [x] 8.1 Rewrite the "Initial VPS Setup" section for the Infomaniak flow: order a 4 GB VPS Debian 13 (Geneva), add deploy SSH public key at the console, note the new IP, set DNS A record, GitHub secrets list
  - [x] 8.2 Remove stale content: 4GB/80GB specs, `git clone`-based manual deploy, Docker Hub references (the full doc rewrite to match deployed reality happens in 6.5 — here only the provisioning story becomes true)

### Review Findings

- [x] [Review][Decision] Automate the key-auth prerequisite before SSH hardening? — the playbook disables password auth with no in-playbook assertion that the deploy key actually authenticates; verification is only a manual docs step (spec Scope Boundary chose manual + KVM recovery). An operator who skips it locks every SSH session out. Options: add an assert task (e.g. non-empty `authorized_keys` / journalctl "Accepted publickey") before the drop-in, or keep the manual check per spec. [deploy/ansible/playbook.yml:223-238] — resolved 2026-09-23: assert task added before the drop-in (fails the play if the app user has no public key)
- [x] [Review][Decision] Docker publishes ports via iptables chains that bypass ufw INPUT — `ufw status` showing "only 22/80/443" is not a guarantee once compose publishes ports (currently only 80; 6.3/6.4 will add 443+). Options: add DOCKER-USER/after.rules filtering now, document the bypass in DEPLOYMENT.md, or own it in 6.3 where compose is rewritten. [deploy/ansible/playbook.yml:185-187] — resolved 2026-09-23: DOCKER-USER guard added to the playbook (internal subnets + 80/443 pass, rest dropped), bypass documented in DEPLOYMENT.md
- [x] [Review][Decision] fail2ban has no `ignoreip` — 5 rapid auth failures/10m bans the source for 1h, including a CI runner with a bad secret or the operator's own IP. Options: whitelist loopback only (safe default), add the operator's static CIDR (Pelo must supply it), or leave as-is (banning CI egress is arguably correct behavior). [deploy/ansible/playbook.yml:202-211] — resolved 2026-09-23: ignoreip = 127.0.0.1/8 ::1 (loopback only)
- [x] [Review][Decision] No unattended-upgrades — an internet-exposed, snapshot-less box has no automatic security patching (kernel/openssl/sshd CVEs accumulate). Options: add `unattended-upgrades` + drop-in to the playbook now, or defer to the 6.5 operations runbook. [deploy/ansible/playbook.yml — security section] — resolved 2026-09-23: unattended-upgrades + security-origin drop-in added to the playbook
- [x] [Review][Patch] Swapfile size unverified — `dd` is guarded by `creates: /swapfile` (existence, not size); an interrupted first run leaves a truncated file that a re-run then formats and activates as undersized swap. Add a stat size check (recreate when `stat.size != 2147483648`). [deploy/ansible/playbook.yml:118-126]
- [x] [Review][Patch] fstab swap entry can degrade boot — the `mount` task is unconditional (deliberate, protects partial first runs) but on a box with pre-existing ≥2G swap and no `/swapfile` it writes a dangling fstab entry → failed swap unit every boot. Add `opts: sw,nofail` — keeps the unconditional choice, removes the boot risk. [deploy/ansible/playbook.yml:140-146]
- [x] [Review][Patch] SSH hardening never asserted against the effective config — `sshd -t` validates file syntax only; a drop-in named `99-` loses to earlier `sshd_config.d/*.conf` files (sshd first-value-wins) and depends on the stock `Include` line. Replace the validate task with `sshd -T | grep` assertions (`passwordauthentication no`, `permitrootlogin no`). [deploy/ansible/playbook.yml:223-238] — resolved 2026-09-23: assert task added before the drop-in (fails the play if the app user has no public key)
- [x] [Review][Patch] fail2ban `backend = systemd` without `python3-systemd` pinned — the journal bindings ship only as a Recommends; verified working on this box but not guaranteed on a rebuild. Add `python3-systemd` to the apt list. [deploy/ansible/playbook.yml:192-196]
- [x] [Review][Patch] `community.general` collection undeclared — all six ufw tasks need it; it is not bundled with ansible-core, no requirements.yml exists, and DEPLOYMENT.md prerequisites say only "Ansible". A fresh machine dies at the first ufw task, mid-play. Add `deploy/ansible/requirements.yml` + a prerequisites line. [deploy/ansible/playbook.yml:152-187, docs/DEPLOYMENT.md:31]
- [x] [Review][Patch] `VPS_HOST` GitHub secret not mentioned on IP change — Step 4 says update `ansible_host` only; the IP already drifted once (83.228.196.103 → 179.237.99.47) and CI would SSH to the stale IP. Add a Step 4 line. [docs/DEPLOYMENT.md:122-123]
- [x] [Review][Patch] First ansible run to a new IP hits the host-key prompt — no ssh-keyscan step documented; the run hangs or aborts. Add `ssh-keyscan <VPS_IP> >> ~/.ssh/known_hosts` to Step 4. [docs/DEPLOYMENT.md:126-130]
- [x] [Review][Patch] SSH allowed with plain `allow` instead of `limit` — no firewall-layer rate limit; fail2ban is the only brake and acts only after failures accumulate. Use `rule: limit` for port 22. [deploy/ansible/playbook.yml:167-171]
- [x] [Review][Patch] "Rebuild-from-scratch path" overstates a re-run — it rebuilds the OS layer only; `mysql_data/`, `storage/`, and any altered state in the app dir survive. An operator could treat a re-run as incident recovery. Reword header comment + doc line to "OS layer only". [deploy/ansible/playbook.yml:5-6, docs/DEPLOYMENT.md:129]
- [x] [Review][Patch] Hardening drop-in lacks `AllowUsers debian` — key-only auth still admits a key held for any account. Add `AllowUsers debian` (from `ansible_user`) to the drop-in and the sshd -T assertion. [deploy/ansible/playbook.yml:223-233]
- [x] [Review][Patch] Story text still says 2 GB / Debian 12 in AC 1 given-clause, Task 8.1, and Dev Notes — the real box is 4 GB / Debian 13 (dev record + corrected epics); the diff is right, the story text was never reconciled. Align story wording. [6-2 story file]
- [x] [Review][Patch] Story Verification contradicts implemented reachability — Verification says "connection accepted"; Dev Notes + dev record + DEPLOYMENT.md all say fast `Connection refused` (port open, nothing bound). Align the Verification bullet. [6-2 story file]
- [x] [Review][Patch] DNS check covers apex only — no `dig +short lachatadede.venanciohugo.fr` step; subdomain breakage goes unnoticed until 6.3. Add the second dig to Step 3. [docs/DEPLOYMENT.md:87-94]
- [x] [Review][Patch] Inventory declares no private key — docs mandate `~/.ssh/id_rsa_vps` but nothing tells Ansible to use it (relies on the operator's ssh config/agent). Add `ansible_ssh_private_key_file: ~/.ssh/id_rsa_vps` under host vars. [deploy/ansible/inventory.yml:5-8]
- [x] [Review][Defer] Git-based clone flow in test.yml vs a gitless box — Stage 6 (`git clone`/`git fetch` on the VPS, plus `rm -rf` of the app dir) fails on every push to main until 6.3 replaces the pipeline; story Scope Boundary documents the transition. [.github/workflows/test.yml:375-384] — deferred, owned by story 6.3
- [x] [Review][Defer] Stale pipeline/doc sections — "Manual Deployment" (ssh `vps_deploy`, `git pull`, `docker compose build`), authorized_keys troubleshooting lines, and missing DOCKERHUB secrets rows contradict the new flow; Task 8.2 defers the pipeline/backup doc rewrite to 6.3/6.5. [docs/DEPLOYMENT.md:143-166,196-197] — deferred, owned by stories 6.3/6.5
- [x] [Review][Defer] IPv6 unmanaged by the playbook — the kept AAAA works today (verified live) but the doc asserts "the box gets the IPv6 configured" while nothing provisions it on a rebuild. [docs/DEPLOYMENT.md:96-101] — deferred, add an IPv6 verify step with 6.3's nginx work
- [x] [Review][Defer] Minor ops hygiene — manual ufw rules survive re-runs ("exactly 22/80/443" drifts), and `id_rsa_vps` is an ed25519 key with no rotation guidance. [deploy/ansible/playbook.yml:167-187, docs/DEPLOYMENT.md:62] — deferred, cosmetic/ops-hygiene

(5 findings dismissed as noise: apt cache — already updated at playbook.yml:22-25; IPv6 fail2ban banaction — default `banaction_v6` covers v6, speculative; "green twice" Verification phrasing — the failed first idempotency re-run is transparently logged in Debug Log References; swap `< 2000` vs spec's `< 2048` — sound documented off-by-one fix, the spec number was the bug; doc edits beyond declared sections — benign and logged in the dev record.)

## Verification

- Playbook runs green twice (second run = idempotency check)
- Manual checklist from Task 6 all pass on the real box
- `ssh` with key works; password auth refused; root refused
- `venanciohugo.fr` resolves and the box answers on port 80 (nothing serving yet — fast `Connection refused`, never a timeout; no HTTP 200 required)

## Dev Notes

**Why this story exists (Epic 6, decisions locked 2026-09-20):** the old VPS is ghosted (`83.228.196.103` — a 4GB box assumption baked into old docs). Pelo ordered a **4 GB Infomaniak VPS (Debian 13, Geneva)** with a fresh IP. All 2GB-era mitigations ship across the epic (the 2G swapfile stays valid on 4 GB); this story owns the OS-level ones (swap, tuned firewall; MySQL tuning + registry-based deploys arrive in 6.3, dumps in 6.5). VPS Lite has **no provider snapshots** — the box must be rebuildable from this playbook, hence "reproducible from the repo".

**Current state of the files you will touch (read them before editing):**

- `deploy/ansible/inventory.yml` (13 lines): single host `vps`, ghost IP `83.228.196.103`, user `debian`, python3 interpreter, `production` group.
- `deploy/ansible/playbook.yml` (124 lines): `become: true`, `vars: app_user: debian, app_path: /home/debian/lachatadede`, modern Docker install (GPG key at `/etc/apt/keyrings/docker.asc`, repo for `{{ ansible_distribution_release }}`), docker group, app dirs, git install, restart-docker handler. **All of that stays valid for the new box** — you are ADDING swap/ufw/fail2ban/ssh-hardening sections, not rewriting Docker.
- `docs/DEPLOYMENT.md` (234 lines): describes the OLD world (4GB, `git clone` on box, Docker Hub, manual scp deploy). Only the provisioning part is corrected in this story; the pipeline/backups sections get their 6.3/6.5 rewrites.

**Ansible specifics that prevent common failures:**

- Swap idempotency: `when: ansible_swaptotal_mb < 2048` guard, then `dd`/`fallocate` → `chmod 600` → `mkswap` → `swapon` → fstab line via `mount` module (`src=/swapfile fstype=swap opts=sw`).
- ufw: install → set policies → allow rules → enable LAST. Ansible's `community.general.ufw` or raw `ufw` command both fine; keep it simple with `ufw: rule=allow port=X proto=tcp`.
- fail2ban on Debian 13: package `fail2ban`; sshd jail enabled by default but Debian needs `/etc/fail2ban/jail.local` (backend defaults changed); `fail2ban-client status sshd` as the smoke test.
- SSH drop-in: Debian 13 supports `Include /etc/ssh/sshd_config.d/*.conf` (already in the stock config). Use `notify: restart sshd` handler with `sshd -t` validation in a pre-task. NEVER set these in the main sshd_config directly.
- Docker group membership needs a re-login to take effect for the `debian` user — the playbook's `docker run hello-world` check must run via `become_user: debian` with `become: true`, or through a fresh SSH session, not by reusing the become session that installed it.

**What "reachable" means for AC 4:** before the app exists, `curl -I http://venanciohugo.fr` should fail with `Connection refused` (port open, nothing bound — nginx arrives in 6.3) or a 4xx from Infomaniak defaults — the failure must NOT be a timeout (that would mean firewall/DNS is wrong). Document the exact expected output in DEPLOYMENT.md.

### Project Structure Notes

- Modified: `deploy/ansible/inventory.yml`, `deploy/ansible/playbook.yml`, `docs/DEPLOYMENT.md` (Initial VPS Setup + Prerequisites sections only)
- Created: nothing (all files exist)
- Ansible runs from Pelo's machine; no CI integration for provisioning (one-time + rebuild tool)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.2-VPS-Ordered-and-Provisioned-Ansible] (ACs verbatim)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-6] (4 GB Infomaniak VPS Debian 13 Geneva, 2GB mitigation list, no snapshots)
- [Source: deploy/ansible/inventory.yml] (ghost IP to replace)
- [Source: deploy/ansible/playbook.yml] (existing Docker + dirs tasks to preserve)
- [Source: docs/DEPLOYMENT.md] (outdated provisioning section to correct)
- [Source: tech-spec-docker-ansible-deployment.md#Review-Notes] (F13: modern GPG key handling already applied — keep it)

## Dev Agent Record

### Agent Model Used

opencode — euria-code (Infomaniak)

### Debug Log References

- First playbook run: all tasks `changed`, handlers fired (fail2ban + sshd restarted), reached PLAY RECAP with no FAILED.
- Idempotency re-run #1 FAILED (the check working as designed): `mkswap: error: /swapfile is mounted; will not make swapspace`. Root cause: a 2 GiB swapfile reports `ansible_swaptotal_mb = 2047` (2147479552 bytes floored), so the Dev-Notes guard `< 2048` is off-by-one. Fix: threshold lowered to `< 2000` (playbook.yml, 4 swap tasks).
- Idempotency re-run #2: `ok=26 changed=0 unreachable=0 failed=0 skipped=4` (4 skips = guarded swap tasks).
- Reachability investigation (Task 7): TCP 80/443 **timed out** from my machine and 3 independent external vantage points (check-host.net: PT, RU, US) while TCP 22 passed; box kernel rules were correct (`ufw-user-input` ACCEPT 80/443) and local curl refused fast → drop was at Infomaniak's edge. Pelo found the managed **Firewall** attached to the VPS in the Infomaniak manager and added allow rules for TCP 80 + 443 (kept 22). Ports now answer `Connection refused` (fast) — correct pre-app state.
- Task 6.2 post-checks (fresh SSH session, real box): all pass — see Completion Notes.

### Completion Notes List

- **Task 1:** `inventory.yml` now holds `179.237.99.47`; ghost IP gone from operational files (remaining grep hits are only in story/planning meta-docs). User/interpreter unchanged.
- **Task 2:** existing Docker + app-dir tasks preserved verbatim (modern GPG keyring per F13); "Install Git" removed — the 6.3 registry pipeline never clones on the box.
- **Task 3:** `/swapfile` 2G (0600, mkswap, swapon, fstab via `mount` module). Deviation from Dev Notes (documented): guard threshold `2000` instead of `2048` (off-by-one above), and the fstab task left **unconditional** — it is idempotent by itself and guarantees a partial first run can never lose swap on reboot.
- **Task 4:** ufw default deny in / allow out, allow 22/80/443, enabled strictly last; fail2ban with `/etc/fail2ban/jail.local` (bantime 1h, findtime 10m, maxretry 5, `backend = systemd` for journald-only Debian 13 — no rsyslog/auth.log on this box).
- **Task 5:** `/etc/ssh/sshd_config.d/99-hardening.conf` (PubkeyAuthentication yes, PasswordAuthentication no, KbdInteractiveAuthentication no, PermitRootLogin no) validated twice: `copy` module `validate: sshd -t -f %s` pre-install + post-task `sshd -t` on the effective config; restart via `notify`. Deploy key verified from the local machine BEFORE hardening ran (story prerequisite). No lockout: key auth re-verified after restart.
- **Task 6:** playbook green twice (2nd run `changed=0 failed=0`). Post-checks: `docker run hello-world` as debian ✓ · `sudo swapon --show` → `/swapfile 2G` ✓ · `sudo ufw status` → exactly 22/80/443 (v4+v6) ✓ · `fail2ban-client status sshd` responds (journal matches ssh.service) ✓ · effective sshd: password=no, root=no, pubkey=yes ✓ · `ssh -o PreferredAuthentications=password` refused (exit 255) ✓ · `ssh root@` refused ✓.
- **Task 7:** Pelo added the apex A record (18:35 UTC); authoritative NS confirms `venanciohugo.fr → 179.237.99.47`; subdomain A + AAAA in place, **AAAA kept** per Pelo's choice (box has `2001:1600:18:208::187/128` bound, ufw v6 allows 80/443; nginx serves it from 6.3). Probe result: fast `Connection refused`, never a timeout (verified via `curl --resolve` while local negative DNS cache expired).
- **Task 8:** `docs/DEPLOYMENT.md` Initial VPS Setup rewritten for the Infomaniak flow (order → SSH key at console → DNS A records table → ansible run → verify checklist → expected curl behavior + Infomaniak edge-firewall gotcha documented). Removed: 4GB/80GB spec line, git-clone "Option B", manual `authorized_keys` flow, key name `github-deploy` → real `id_rsa_vps`. Security Notes checklist updated (ufw/fail2ban/SSH done; TLS 6.4 + backups 6.5 pending). Pipeline/backup sections intentionally untouched (6.3/6.5 own them).
- **Tests:** infrastructure story — no unit/integration framework applies. Correctness is validated by the story's own Verification section: two green playbook runs (idempotency), syntax-check clean, and the full on-box manual checklist — all pass. No app code touched, so no app regression suite was run.
- **Scope respected:** app directory created but EMPTY (no clone, no compose up); 443 open with nothing serving TLS yet; 6.3/6.4/6.5 boundaries untouched.
- **~~⚠️ Observation~~ Resolved:** Pelo confirmed the box is a **4 GB RAM** plan (story assumed "VPS Lite 2GB" — the 2G swap task remains valid on 4 GB). Debian measured 13.5 — docs say "Debian 13" (AC 1's version; the Dev Notes' "Debian 12" references were stale). **Note for 6.3:** epic planning sized MySQL tuning for 2 GB — revisit against the real 4 GB before implementing.

### File List

- deploy/ansible/inventory.yml (modified — new VPS IP 179.237.99.47, declared ansible_ssh_private_key_file)
- deploy/ansible/playbook.yml (modified — swap/ufw/fail2ban/SSH-hardening/unattended-upgrades added, Git task removed, header updated, handlers added)
- deploy/ansible/requirements.yml (created in review — community.general collection pin)
- docs/DEPLOYMENT.md (modified — Infomaniak provisioning flow, spec line, security status)

## Change Log

- 2026-09-23: Story implemented. VPS 179.237.99.47 provisioned via Ansible (Docker + compose plugin, 2G swapfile, ufw 22/80/443, fail2ban sshd jail, SSH key-only hardening); playbook verified idempotent; DNS live for apex + subdomain (edge firewall fixed at the Infomaniak console); DEPLOYMENT.md provisioning sections rewritten. Ready for review.
- 2026-09-23: Code review (gds-code-review — Blind Hunter / Edge Case Hunter / Acceptance Auditor, 41 raw findings → 22 after triage, 5 dismissed). 18 patches applied: playbook — key-auth assert pre-task, DOCKER-USER ufw guard, fail2ban `ignoreip` + `python3-systemd` pin, unattended-upgrades, swapfile size guard (stat + teardown of incomplete files), fstab `nofail`, ufw `limit` on 22, `AllowUsers debian`, effective-config assertions (`sshd -T`); inventory — declared `ansible_ssh_private_key_file`; new `deploy/ansible/requirements.yml` (community.general); DEPLOYMENT.md — collection install, ssh-keyscan first-run step, subdomain dig check, VPS_HOST secret note, "OS layer only" rewording; story text aligned to the real 4 GB / Debian 13 box and the measured `Connection refused` reachability. Status → in-progress pending one playbook re-run against the box.
