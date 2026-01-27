---
title: 'Docker + Ansible Deployment Pipeline'
slug: 'docker-ansible-deployment'
created: '2026-01-26'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Docker
  - Docker Compose
  - Ansible
  - GitHub Actions
  - Nginx
  - PHP-FPM 8.2
  - Node.js 20
  - MySQL 8
files_to_modify:
  - '.github/workflows/deploy.yml (CREATE)'
  - 'deploy/docker/Dockerfile.api (CREATE)'
  - 'deploy/docker/Dockerfile.node (CREATE)'
  - 'deploy/docker-compose.yml (CREATE)'
  - 'deploy/nginx/default.conf (CREATE)'
  - 'deploy/ansible/playbook.yml (CREATE)'
  - 'deploy/ansible/inventory.yml (CREATE)'
  - 'deploy/.env.example (CREATE)'
  - 'docs/DEPLOYMENT.md (CREATE)'
code_patterns:
  - 'GitHub Actions workflow with needs dependencies'
  - 'SSH deployment via appleboy/ssh-action'
  - 'Docker multi-stage builds'
  - 'Ansible YAML playbooks'
test_patterns:
  - 'Existing test.yml runs lint, unit, e2e before deploy'
  - 'Deploy job uses needs: [e2e-tests] for dependency'
domain: 'venanciohugo.fr'
vps_path: '/home/pelo/lachatadede'
---

# Tech-Spec: Docker + Ansible Deployment Pipeline

**Created:** 2026-01-26

## Overview

### Problem Statement

The deployment architecture is fully documented in `deployment-architecture.md` but no actual infrastructure files exist in the repository. Deploying requires manual SSH access and running multiple commands, which is error-prone, slow, and not reproducible.

### Solution

Create actual Dockerfiles and docker-compose.yml in the repository, a minimal Ansible playbook for VPS provisioning (install Docker, create directories), and a GitHub Actions workflow that automatically deploys to the VPS when tests pass on push to main branch.

### Scope

**In Scope:**
- Dockerfiles for Laravel (PHP-FPM) and Node.js game engine
- docker-compose.yml for production
- Nginx configuration file
- Ansible playbook (minimal): install Docker, create app directories, first-time setup
- GitHub Actions workflow: test → build → deploy via SSH
- Documentation for GitHub Secrets setup
- Domain configuration for `venanciohugo.fr`

**Out of Scope:**
- SSL/HTTPS configuration (Let's Encrypt) - future security task
- Firewall (ufw) configuration - future security task
- Automated database backups - future task
- Monitoring/alerting - future task
- Multi-environment setup (staging/prod) - single prod environment for MVP

## Context for Development

### Codebase Patterns

**Project Structure:**
- Frontend: React app at project root (`/src`, `package.json`) - builds to `/dist/`
- Backend: Laravel API at `/lachatadede-api/`
- Game Engine (server-side): NOT YET CREATED - planned for Epic 3, include placeholder in docker-compose
- Canvas Engine: `src/components/canvas/engine/` - this is frontend rendering, not server-side

**Existing CI (`.github/workflows/test.yml`):**
- Stages: lint → unit-tests → e2e-tests (4 shards) → burn-in (PRs only) → merge-reports
- Node.js 24, npm ci, Playwright for E2E
- Deploy workflow should add new job that `needs: [e2e-tests]`

**VPS Target:**
- Debian VPS: 4 cores, 4GB RAM, 80GB SSD
- Deploy path: `/home/pelo/lachatadede/`
- Domain: `venanciohugo.fr`
- User: pelo

**Clean Slate Confirmed:**
- No existing Dockerfiles (only Laravel Sail in vendor - not for production)
- No Ansible playbooks
- No deploy workflow
- No infrastructure directory

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `_bmad-output/planning-artifacts/deployment-architecture.md` | Complete Docker specs to extract |
| `.github/workflows/test.yml` | Existing CI - deploy job will depend on e2e-tests |
| `lachatadede-api/.env.example` | Laravel env template (currently uses SQLite, prod needs MySQL) |
| `lachatadede-api/` | Laravel API source for Dockerfile |
| `src/` | React frontend source |
| `package.json` | Frontend build commands |

### Technical Decisions

- **Minimal Ansible:** Only provision Docker and directory structure; GitHub Actions handles app deployment
- **Single docker-compose:** One compose file for production (no dev/staging split for MVP)
- **Deploy via SSH:** Use `appleboy/ssh-action` to SSH to VPS and run docker-compose commands
- **Frontend build in CI:** Build React in GitHub Actions, deploy as part of Laravel public folder
- **Domain:** Configure Nginx for `venanciohugo.fr` (HTTP first, SSL later)
- **Node.js service placeholder:** Include container definition for future Epic 3 implementation
- **Separate deploy.yml:** Create new workflow file rather than extending test.yml (cleaner separation)
- **Deploy directory structure:** All infra files in `/deploy/` to keep root clean

## Implementation Plan

### Tasks

- [x] **Task 1: Create deploy directory structure**
  - Files: `deploy/`, `deploy/docker/`, `deploy/nginx/`, `deploy/ansible/`
  - Action: Create empty directory structure for all deployment files
  - Notes: All infra files live under `/deploy/` to keep project root clean

- [x] **Task 2: Create Laravel API Dockerfile**
  - File: `deploy/docker/Dockerfile.api`
  - Action: Create PHP 8.2-FPM Dockerfile with:
    - Base image: `php:8.2-fpm`
    - Extensions: pdo_mysql, mbstring, exif, pcntl, bcmath, gd
    - Composer install from official image
    - Working directory: `/var/www/html`
    - Optimize autoloader, no-dev dependencies
    - Set permissions for storage and bootstrap/cache
  - Reference: `deployment-architecture.md` lines 176-192

- [x] **Task 3: Create Node.js Game Engine Dockerfile (placeholder)**
  - File: `deploy/docker/Dockerfile.node`
  - Action: Create Node.js 20-alpine Dockerfile with:
    - Base image: `node:20-alpine`
    - Working directory: `/app`
    - Python3/make/g++ for native dependencies
    - npm ci production only
    - Expose port 3001
    - Entry: `node dist/index.js`
  - Notes: Placeholder for Epic 3 - game engine not yet created
  - Reference: `deployment-architecture.md` lines 198-213

- [x] **Task 4: Create docker-compose.yml**
  - File: `deploy/docker-compose.yml`
  - Action: Create compose file with 4 services:
    - `nginx`: nginx:alpine, port 80, volumes for config/laravel/storage
    - `laravel`: build from Dockerfile.api, volumes for code/storage, env vars for DB
    - `node`: build from Dockerfile.node, shared storage volume, port 3001
    - `mysql`: mysql:8.0, persistent volume, env vars from .env
  - Network: `lachatadede_net` (bridge driver)
  - All services: `restart: unless-stopped`
  - Reference: `deployment-architecture.md` lines 103-169

- [x] **Task 5: Create Nginx configuration**
  - File: `deploy/nginx/default.conf`
  - Action: Create Nginx server config with:
    - Listen port 80
    - `server_name venanciohugo.fr`
    - Root: `/var/www/html/public`
    - SPA fallback: `try_files $uri $uri/ /index.php?$query_string`
    - PHP-FPM upstream: `fastcgi_pass laravel:9000`
    - Static asset caching: 1 year for js/css/images
    - Deny access to hidden files
  - Reference: `deployment-architecture.md` lines 219-250

- [x] **Task 6: Create deploy environment template**
  - File: `deploy/.env.example`
  - Action: Create environment template with:
    - MySQL credentials: `MYSQL_ROOT_PASSWORD`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
    - Laravel: `APP_ENV=production`, `APP_KEY`, `APP_DEBUG=false`, `APP_URL`
    - Node: `NODE_ENV=production`, `PORT=3001`
  - Notes: Document that actual values come from GitHub Secrets

- [x] **Task 7: Create Ansible inventory**
  - File: `deploy/ansible/inventory.yml`
  - Action: Create inventory with:
    - Host group: `production`
    - Host: `vps` with `ansible_host` variable (placeholder for IP)
    - User: `pelo`
    - Python interpreter: `/usr/bin/python3`
  - Notes: User replaces placeholder with actual VPS IP

- [x] **Task 8: Create Ansible playbook for VPS provisioning**
  - File: `deploy/ansible/playbook.yml`
  - Action: Create minimal playbook with tasks:
    - Update apt cache
    - Install Docker and Docker Compose
    - Add user to docker group
    - Create app directory: `/home/pelo/lachatadede`
    - Create subdirectories: `mysql_data`, `storage/simulations`
    - Set directory permissions
  - Notes: One-time setup only; GitHub Actions handles deployments
  - Reference: `deployment-architecture.md` lines 276-303

- [x] **Task 9: Create GitHub Actions deploy workflow**
  - File: `.github/workflows/deploy.yml`
  - Action: Create workflow with:
    - Trigger: `push` to `main` branch only
    - Job `deploy` with `needs: [e2e-tests]` (reference test.yml job name)
    - Steps:
      1. Checkout code
      2. Setup Node.js 24
      3. Install dependencies (`npm ci`)
      4. Build frontend (`npm run build`)
      5. SSH to VPS using `appleboy/ssh-action@v1.0.3`:
         - Pull latest code
         - Copy frontend build to Laravel public
         - Build Docker images
         - Run docker-compose up -d
         - Run Laravel migrations
         - Clear Laravel cache
      6. Health check: curl the API endpoint
  - Secrets required: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `APP_KEY`
  - Reference: Existing test.yml structure for consistency

- [x] **Task 10: Create deployment documentation**
  - File: `docs/DEPLOYMENT.md`
  - Action: Create documentation with sections:
    - **Prerequisites**: VPS access, domain pointed to IP
    - **GitHub Secrets Setup**: Step-by-step for each required secret
    - **Initial VPS Setup**: How to run Ansible playbook
    - **Automatic Deployments**: How the CI/CD pipeline works
    - **Manual Deployment**: Commands for manual deploy if needed
    - **Troubleshooting**: Common issues and solutions
    - **Architecture Diagram**: ASCII diagram from deployment-architecture.md
  - Notes: User is new to GitHub Secrets - be explicit with instructions

### Acceptance Criteria

- [x] **AC 1**: Given the deploy directory structure is created, when I run `ls deploy/`, then I see `docker/`, `nginx/`, `ansible/`, `.env.example`

- [x] **AC 2**: Given `deploy/docker/Dockerfile.api` exists, when I run `docker build -f deploy/docker/Dockerfile.api lachatadede-api/`, then the image builds successfully with PHP 8.2-FPM and all required extensions

- [x] **AC 3**: Given `deploy/docker/Dockerfile.node` exists, when I run `docker build -f deploy/docker/Dockerfile.node .`, then the image builds successfully (may fail on npm ci since game engine doesn't exist yet - expected)

- [x] **AC 4**: Given all Docker files exist and `.env` is configured, when I run `docker-compose -f deploy/docker-compose.yml config`, then the compose file validates without errors

- [x] **AC 5**: Given Nginx config exists, when the nginx container starts, then it serves requests on port 80 and proxies PHP to Laravel container

- [x] **AC 6**: Given the Ansible inventory has the correct VPS IP, when I run `ansible-playbook -i deploy/ansible/inventory.yml deploy/ansible/playbook.yml`, then Docker is installed and directories are created on the VPS

- [x] **AC 7**: Given GitHub Secrets are configured and tests pass on main branch, when I push to main, then the deploy workflow triggers and completes successfully

- [x] **AC 8**: Given a successful deployment, when I visit `http://venanciohugo.fr`, then I see the React frontend served by Nginx

- [x] **AC 9**: Given a successful deployment, when I call `http://venanciohugo.fr/api/health`, then I receive a 200 response from Laravel

- [x] **AC 10**: Given the deploy workflow fails, when I check GitHub Actions logs, then I can identify the failure reason from the logged output

## Additional Context

### Dependencies

**GitHub Secrets Required:**
| Secret | Description | How to Generate |
| ------ | ----------- | --------------- |
| `VPS_HOST` | VPS IP address or hostname | Get from VPS provider dashboard |
| `VPS_USER` | SSH username | `pelo` |
| `VPS_SSH_KEY` | Private SSH key for deployment | `ssh-keygen -t ed25519 -C "github-deploy"` - add public key to VPS `~/.ssh/authorized_keys` |
| `DB_PASSWORD` | MySQL user password | Generate: `openssl rand -base64 32` |
| `DB_ROOT_PASSWORD` | MySQL root password | Generate: `openssl rand -base64 32` |
| `APP_KEY` | Laravel application key | `php artisan key:generate --show` or generate in deployment |

**External Dependencies:**
- VPS must be accessible via SSH
- Domain `venanciohugo.fr` must point to VPS IP (A record)
- GitHub repository secrets must be configured before first deploy

### Testing Strategy

**Pre-deploy Validation:**
- Existing test.yml workflow runs lint, unit tests, and E2E tests
- Deploy job only runs if all tests pass (`needs: [e2e-tests]`)

**Post-deploy Verification:**
- Health check curl in deploy workflow: `curl -f http://venanciohugo.fr/api/health`
- Manual smoke test: Visit frontend, verify API calls work

**Local Validation:**
- Docker images can be built locally before push
- docker-compose config validates syntax
- Ansible playbook can be dry-run: `ansible-playbook --check`

### Notes

**High-Risk Items:**
- SSH key configuration - if incorrect, deploy will fail silently or hang
- MySQL credentials mismatch between .env and GitHub Secrets
- Nginx config errors may cause 502 Bad Gateway

**Known Limitations:**
- No SSL/HTTPS - site will be HTTP only until Let's Encrypt task is completed
- No automated rollback - if deploy fails, manual intervention required
- Node.js container is placeholder - will error until Epic 3 implements game engine

**Future Considerations (Out of Scope):**
- SSL with Let's Encrypt and automatic renewal
- Blue-green or rolling deployments
- Database backup automation
- Monitoring and alerting (e.g., Uptime Robot, Sentry)
- Multi-environment setup (staging/production)

## Review Notes

- Adversarial review completed
- Findings: 14 total, 11 fixed, 3 skipped (noise/out-of-scope)
- Resolution approach: auto-fix

### Fixes Applied:
- F1: Wait for all E2E shards + unit tests + lint (not just shard 1)
- F2: Node.js version aligned to 24 in Dockerfile.node
- F3: Secrets passed via environment variables, not sed command line
- F4: MySQL healthcheck + migration retry logic added
- F5: Frontend copied BEFORE services start (race condition fixed)
- F6: Dockerfile layer caching optimized (composer.json copied first)
- F7: .dockerignore files added for Laravel API and deploy contexts
- F11: Volume mounts fixed to preserve composer-installed dependencies
- F12: Health check runs via SSH on VPS (not from GH runner)
- F13: Ansible apt_key replaced with modern GPG key handling
- F14: Additional Laravel env vars added (SESSION_DRIVER, CACHE_STORE, etc.)

### Skipped (noise/out-of-scope):
- F8: Already resolved by user (inventory updated with hugo/IP)
- F9: SSL documented as out of scope
- F10: Node crash loop expected (placeholder, restart: "no")
