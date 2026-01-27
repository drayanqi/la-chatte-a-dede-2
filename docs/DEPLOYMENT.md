# Deployment Guide - La Chatte à Dédé

This guide covers deploying La Chatte à Dédé to a Debian VPS using Docker and GitHub Actions.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VPS DEBIAN                                         │
│                     4 CPU | 4 Go RAM | 80 Go SSD                             │
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

1. **VPS Access**: SSH access to your Debian VPS
2. **Domain**: `venanciohugo.fr` pointed to your VPS IP (A record)
3. **GitHub Secrets**: Configured in your repository

## GitHub Secrets Setup

Navigate to your repository: **Settings > Secrets and variables > Actions**

Create these secrets:

| Secret | Description | How to Get It |
|--------|-------------|---------------|
| `VPS_HOST` | VPS IP address | Get from your VPS provider dashboard |
| `VPS_USER` | SSH username | `pelo` |
| `VPS_SSH_KEY` | Private SSH key | See "Generate SSH Key" below |
| `DB_PASSWORD` | MySQL user password | `openssl rand -base64 32` |
| `DB_ROOT_PASSWORD` | MySQL root password | `openssl rand -base64 32` |
| `APP_KEY` | Laravel application key | `php artisan key:generate --show` |

### Generate SSH Key for Deployment

On your local machine:

```bash
# Generate a new SSH key for deployment
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github-deploy

# Display the public key (add this to VPS)
cat ~/.ssh/github-deploy.pub

# Display the private key (add this to GitHub Secrets as VPS_SSH_KEY)
cat ~/.ssh/github-deploy
```

On your VPS:

```bash
# Add the public key to authorized_keys
echo "your-public-key-here" >> ~/.ssh/authorized_keys
```

## Initial VPS Setup

### Option A: Using Ansible (Recommended)

1. Update the inventory file with your VPS IP:
   ```bash
   # Edit deploy/ansible/inventory.yml
   # Replace YOUR_VPS_IP with actual IP
   ```

2. Run the playbook:
   ```bash
   ansible-playbook -i deploy/ansible/inventory.yml deploy/ansible/playbook.yml
   ```

### Option B: Manual Setup

SSH into your VPS and run:

```bash
# Install Docker
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER

# Logout and login again to apply docker group

# Create directories
mkdir -p /home/pelo/lachatadede
mkdir -p /home/pelo/lachatadede/mysql_data
mkdir -p /home/pelo/lachatadede/storage/simulations

# Clone the repository
cd /home/pelo
git clone https://github.com/YOUR_USERNAME/lachatadede.git
cd lachatadede

# Create .env file
cp deploy/.env.example deploy/.env
nano deploy/.env  # Fill in your passwords
```

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
ssh pelo@YOUR_VPS_IP
cd /home/pelo/lachatadede

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

## Security Notes (Future Tasks)

These are planned but not yet implemented:

- [ ] SSL/HTTPS with Let's Encrypt
- [ ] Firewall (ufw) configuration
- [ ] fail2ban for brute force protection
- [ ] Automated database backups

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
