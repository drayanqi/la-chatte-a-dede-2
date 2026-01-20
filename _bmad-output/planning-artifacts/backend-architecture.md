# Architecture Backend - Lachatadede

> **Statut** : VALIDE par Pelo
> **Date** : 2026-01-19
> **Version** : 1.0

---

## Vue d'Ensemble

Architecture microservices avec deux backends:
- **Laravel** : API Gateway, auth, CRUD, gestion DB
- **Node.js** : Game engine, simulation, validation scripts

---

## Infrastructure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                         React + PixiJS + Monaco                              │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ HTTPS (API unique)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VPS PERSONNEL                                   │
│                                                                              │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐ │
│  │      LARAVEL (API Gateway)      │    │      NODE.JS (Game Engine)      │ │
│  │      Port 80/443 (public)       │    │      Port 3001 (interne)        │ │
│  │─────────────────────────────────│    │─────────────────────────────────│ │
│  │  • Auth (Sanctum)               │───►│  POST /validate-script          │ │
│  │  • CRUD Scripts, Tactiques      │    │  POST /simulate                 │ │
│  │  • CRUD Matchs                  │◄───│  → Génère fichier JSON          │ │
│  │  • Import JSON frames           │    │  • Sandboxing (isolated-vm)     │ │
│  │  • Leaderboard                  │    │                                 │ │
│  └───────────────┬─────────────────┘    └─────────────────────────────────┘ │
│                  │                                                           │
│                  ▼                                                           │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐ │
│  │           MYSQL                 │    │   /storage/simulations/*.json   │ │
│  │        Port 3306                │    │   (Frames des matchs)           │ │
│  └─────────────────────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Decisions Techniques

| Aspect | Decision |
|--------|----------|
| Hebergement | VPS personnel |
| API Gateway | Laravel (PHP) |
| Game Engine | Node.js (TypeScript) |
| Base de donnees | MySQL |
| Auth | Laravel Sanctum |
| Communication interne | HTTP synchrone |
| Stockage frames | Fichiers JSON permanents |
| Sandboxing JS | isolated-vm |
| Frontend routing | Laravel uniquement (Node jamais expose) |

---

## Service Laravel

### Structure

```
lachatadede-api/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── AuthController.php
│   │   │   ├── ScriptController.php
│   │   │   ├── TacticController.php
│   │   │   ├── MatchController.php
│   │   │   └── LeaderboardController.php
│   │   ├── Requests/
│   │   └── Resources/
│   ├── Models/
│   │   ├── User.php
│   │   ├── Script.php
│   │   ├── Tactic.php
│   │   ├── TacticPlayer.php
│   │   └── Match.php
│   └── Services/
│       ├── GameEngineService.php   # Appels HTTP vers Node
│       └── PointsService.php
├── database/migrations/
├── routes/api.php
└── storage/simulations/            # JSONs des frames
```

### Endpoints API

```
# Auth
POST   /api/register
POST   /api/login
POST   /api/logout
GET    /api/user

# Scripts
GET    /api/scripts
POST   /api/scripts
GET    /api/scripts/{id}
PUT    /api/scripts/{id}
DELETE /api/scripts/{id}
POST   /api/scripts/{id}/validate

# Tactiques
GET    /api/tactics
POST   /api/tactics
GET    /api/tactics/{id}
PUT    /api/tactics/{id}
DELETE /api/tactics/{id}
GET    /api/tactics/public

# Matchs
POST   /api/matches
GET    /api/matches
GET    /api/matches/{id}
GET    /api/matches/{id}/frames

# Leaderboard
GET    /api/leaderboard
GET    /api/users/{id}/stats
```

---

## Service Node.js (Game Engine)

### Structure

```
lachatadede-engine/
├── src/
│   ├── index.ts              # Fastify/Express server
│   ├── routes/
│   │   ├── validate.ts       # POST /validate-script
│   │   └── simulate.ts       # POST /simulate
│   ├── engine/
│   │   ├── Simulation.ts     # Boucle principale
│   │   ├── Player.ts         # Logique joueur
│   │   ├── Ball.ts           # Logique ballon
│   │   ├── Field.ts          # Terrain + regles
│   │   └── ScriptRunner.ts   # Execution sandboxee (isolated-vm)
│   └── utils/
│       └── seededRandom.ts   # Random deterministe
├── package.json
└── tsconfig.json
```

### Endpoints Internes

```
# Validation script
POST /validate-script
Body: { "code": "...", "language": "javascript" }
Response: { "valid": true } | { "valid": false, "errors": [...] }

# Simulation
POST /simulate
Body: {
  "match_id": "uuid",
  "seed": 12345,
  "output_path": "/path/to/storage/simulations/",
  "challenger": {
    "players": [
      { "slot": 1, "x": 10, "y": 50, "script": "code..." },
      ...
    ]
  },
  "opponent": { ... }
}
Response: {
  "success": true,
  "file": "/storage/simulations/{match_id}.json",
  "result": {
    "score_challenger": 2,
    "score_opponent": 1,
    "duration_frames": 540
  }
}
```

### Limites Sandboxing

| Limite | Valeur |
|--------|--------|
| Timeout par tick | 10ms |
| Timeout total simulation | 30s |
| Memoire par script | 8MB |
| Frames max | 1000 |

---

## Format Fichier JSON Frames

```json
{
  "match_id": "uuid",
  "seed": 12345,
  "total_frames": 540,
  "result": {
    "score_challenger": 2,
    "score_opponent": 1,
    "winner": "challenger"
  },
  "frames": [
    {
      "index": 0,
      "ball": { "x": 50.0, "y": 50.0 },
      "players": [
        { "slot": 1, "team": "challenger", "x": 10.0, "y": 50.0, "state": "idle" },
        { "slot": 2, "team": "challenger", "x": 25.0, "y": 30.0, "state": "moving" }
      ],
      "events": []
    },
    {
      "index": 1,
      "ball": { "x": 51.2, "y": 49.8 },
      "players": [...],
      "events": [{ "type": "pass", "from": "c1", "to": "c3" }]
    }
  ]
}
```

---

## Flux de Simulation

```
1. User POST /api/matches (React → Laravel)
2. Laravel cree Match (status: pending)
3. Laravel POST /simulate → Node.js
4. Node.js execute simulation
5. Node.js ecrit {match_id}.json
6. Node.js retourne resultat
7. Laravel met a jour Match + points users
8. Laravel repond a React
```

---

## Flux de Replay

```
1. User GET /api/matches/{id}/frames (React → Laravel)
2. Laravel lit /storage/simulations/{id}.json
3. Laravel retourne JSON (ou stream)
4. React/PixiJS rejoue frame par frame
```
