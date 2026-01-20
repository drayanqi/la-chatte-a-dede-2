# Architecture Deploiement - Lachatadede

> **Statut** : VALIDE par Pelo
> **Date** : 2026-01-19
> **Version** : 1.0

---

## Infrastructure

| Composant | Specification |
|-----------|---------------|
| **VPS** | Debian |
| **CPU** | 4 cores |
| **RAM** | 4 Go |
| **Stockage** | 80 Go SSD |
| **Domaine** | IP directe (pour l'instant) |
| **Usage** | Dedie a Lachatadede |

---

## Stack de Deploiement

| Outil | Role |
|-------|------|
| **Docker** | Conteneurisation |
| **Docker Compose** | Orchestration |
| **Nginx** | Reverse proxy |
| **PHP-FPM** | Runtime Laravel |
| **Node.js** | Game engine |
| **MySQL 8** | Base de donnees |

---

## Architecture

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
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         VOLUMES                                         ││
│  │  ./mysql_data     → Donnees MySQL                                       ││
│  │  ./laravel        → Code Laravel + Frontend build                       ││
│  │  ./node           → Code Node.js                                        ││
│  │  ./storage        → Frames JSON (partage)                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Structure Fichiers VPS

```
/home/pelo/lachatadede/
├── docker-compose.yml
├── .env
│
├── nginx/
│   └── conf.d/
│       └── default.conf
│
├── laravel/
│   ├── Dockerfile
│   ├── public/
│   │   ├── index.php
│   │   └── build/              # ← Frontend React (npm run build)
│   │       ├── assets/
│   │       └── index.html
│   └── ...
│
├── node/
│   ├── Dockerfile
│   └── src/
│
├── mysql_data/                  # Volume persistant
│
└── storage/
    └── simulations/             # JSONs frames
```

---

## docker-compose.yml

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./laravel:/var/www/html:ro
      - ./storage:/var/www/storage:ro
    depends_on:
      - laravel
    networks:
      - lachatadede_net
    restart: unless-stopped

  laravel:
    build:
      context: ./laravel
      dockerfile: Dockerfile
    volumes:
      - ./laravel:/var/www/html
      - ./storage:/var/www/storage
    environment:
      - DB_HOST=mysql
      - DB_DATABASE=${DB_DATABASE}
      - DB_USERNAME=${DB_USERNAME}
      - DB_PASSWORD=${DB_PASSWORD}
      - GAME_ENGINE_URL=http://node:3001
    depends_on:
      - mysql
    networks:
      - lachatadede_net
    restart: unless-stopped

  node:
    build:
      context: ./node
      dockerfile: Dockerfile
    volumes:
      - ./storage:/app/storage
    environment:
      - NODE_ENV=production
      - PORT=3001
    networks:
      - lachatadede_net
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    volumes:
      - ./mysql_data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=${DB_DATABASE}
      - MYSQL_USER=${DB_USERNAME}
      - MYSQL_PASSWORD=${DB_PASSWORD}
    networks:
      - lachatadede_net
    restart: unless-stopped

networks:
  lachatadede_net:
    driver: bridge
```

---

## Dockerfile Laravel

```dockerfile
FROM php:8.2-fpm

RUN apt-get update && apt-get install -y \
    git curl zip unzip libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY . .

RUN composer install --optimize-autoloader --no-dev
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 9000
CMD ["php-fpm"]
```

---

## Dockerfile Node.js

```dockerfile
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

---

## Config Nginx

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/html/public;
    index index.php index.html;

    # Frontend React SPA
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # API Laravel
    location ~ \.php$ {
        fastcgi_pass laravel:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Assets avec cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~ /\.(?!well-known) {
        deny all;
    }
}
```

---

## Fichier .env

```bash
# MySQL
MYSQL_ROOT_PASSWORD=<generer_mot_de_passe>
DB_DATABASE=lachatadede
DB_USERNAME=lachatadede_user
DB_PASSWORD=<generer_mot_de_passe>

# Laravel
APP_ENV=production
APP_KEY=<php artisan key:generate>
APP_DEBUG=false
APP_URL=http://<IP_DU_VPS>
```

---

## Deploiement Manuel

### Installation initiale (une seule fois)

```bash
# 1. Installer Docker
sudo apt update
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
# Deconnexion/reconnexion pour appliquer le groupe

# 2. Cloner le projet
cd /home/pelo
git clone <repo> lachatadede
cd lachatadede

# 3. Configurer
cp .env.example .env
nano .env  # Remplir les mots de passe

# 4. Build et lancer
docker-compose build
docker-compose up -d

# 5. Laravel setup
docker-compose exec laravel php artisan key:generate
docker-compose exec laravel php artisan migrate --force

# 6. Verifier
docker-compose ps
curl http://localhost
```

### Mise a jour (a chaque deploiement)

```bash
cd /home/pelo/lachatadede

# 1. Pull les changements
git pull origin main

# 2. Rebuild si Dockerfile modifie
docker-compose build

# 3. Relancer
docker-compose up -d

# 4. Migrations si necessaire
docker-compose exec laravel php artisan migrate --force

# 5. Clear cache Laravel
docker-compose exec laravel php artisan config:cache
docker-compose exec laravel php artisan route:cache
```

---

## Frontend (React)

Le frontend React est build localement puis pousse avec le code Laravel:

```bash
# En local, dans le dossier frontend
cd frontend
npm run build

# Copier le build dans Laravel
cp -r dist/* ../laravel/public/build/

# Commit et push
git add .
git commit -m "Build frontend"
git push
```

Sur le VPS, le `git pull` recupere le build.

---

## Estimation Ressources

| Service | RAM | CPU |
|---------|-----|-----|
| Nginx | ~50 Mo | Faible |
| Laravel | ~300 Mo | Moyen |
| Node.js | ~200 Mo | Variable |
| MySQL | ~800 Mo | Moyen |
| Docker overhead | ~200 Mo | - |
| **Total** | **~1.5 Go** | OK |

**Marge disponible : ~2.5 Go RAM**

---

## Commandes Utiles

```bash
# Voir les logs
docker-compose logs -f
docker-compose logs -f laravel
docker-compose logs -f node

# Redemarrer un service
docker-compose restart laravel

# Entrer dans un conteneur
docker-compose exec laravel bash
docker-compose exec node sh

# Arreter tout
docker-compose down

# Supprimer et recreer (attention: perd les donnees si pas de volume)
docker-compose down -v
docker-compose up -d --build
```

---

## Securite (a faire plus tard)

- [ ] Configurer firewall (ufw)
- [ ] Ajouter SSL avec Let's Encrypt (quand domaine)
- [ ] Configurer fail2ban
- [ ] Backup automatique MySQL
