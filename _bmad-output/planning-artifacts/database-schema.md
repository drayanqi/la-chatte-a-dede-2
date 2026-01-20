# Schema Base de Donnees - Lachatadede

> **Statut** : VALIDE par Pelo
> **Date** : 2026-01-19
> **Version** : 3.0 (Multijoueur)

---

## Vue d'Ensemble

Lachatadede est un editeur tactique 5v5 **multijoueur asynchrone** ou les joueurs:
- Creent des scripts IA et des tactiques
- Defient les tactiques d'autres joueurs
- Gagnent/perdent des points (+3 victoire, +1 nul, -1 defaite)
- Revisionnent les matchs en replay

---

## Modes de Jeu

| Mode | Description |
|------|-------------|
| **Multijoueur** | Defier la tactique d'un autre joueur (asynchrone, sans acceptation) |
| **Entrainement** | Jouer contre des IA systeme ou contre soi-meme |

---

## Entites

### UTILISATEUR

```sql
CREATE TABLE utilisateur (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  username        VARCHAR(50) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  points          INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### SCRIPT_IA

```sql
CREATE TABLE script_ia (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  code        TEXT NOT NULL,
  language    VARCHAR(10) CHECK (language IN ('javascript', 'typescript')),
  is_valid    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_script_user ON script_ia(user_id);
```

### TACTIQUE

```sql
CREATE TABLE tactique (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES utilisateur(id) ON DELETE CASCADE,  -- NULL = tactique systeme
  name        VARCHAR(100) NOT NULL,
  is_public   BOOLEAN DEFAULT TRUE,
  is_system   BOOLEAN DEFAULT FALSE,  -- TRUE pour les tactiques d'entrainement
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tactique_user ON tactique(user_id);
CREATE INDEX idx_tactique_public ON tactique(is_public) WHERE is_public = TRUE;
```

### TACTIQUE_JOUEUR

```sql
CREATE TABLE tactique_joueur (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tactic_id    UUID NOT NULL REFERENCES tactique(id) ON DELETE CASCADE,
  player_slot  INT NOT NULL CHECK (player_slot BETWEEN 1 AND 5),
  position_x   FLOAT NOT NULL CHECK (position_x BETWEEN 0 AND 100),
  position_y   FLOAT NOT NULL CHECK (position_y BETWEEN 0 AND 100),
  script_id    UUID REFERENCES script_ia(id) ON DELETE SET NULL,

  UNIQUE(tactic_id, player_slot)
);

CREATE INDEX idx_tactique_joueur_tactic ON tactique_joueur(tactic_id);
```

### MATCH

```sql
CREATE TABLE match (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  challenger_id      UUID NOT NULL REFERENCES utilisateur(id),
  challenger_tactic  UUID NOT NULL REFERENCES tactique(id),

  opponent_id        UUID NOT NULL REFERENCES utilisateur(id),
  opponent_tactic    UUID NOT NULL REFERENCES tactique(id),

  seed               INT NOT NULL,
  score_challenger   INT NOT NULL DEFAULT 0,
  score_opponent     INT NOT NULL DEFAULT 0,
  result             VARCHAR(20) CHECK (result IN ('challenger_win', 'opponent_win', 'draw')),
  points_challenger  INT NOT NULL,  -- +3, +1, ou -1
  points_opponent    INT NOT NULL,  -- +3, +1, ou -1

  duration_frames    INT NOT NULL,
  created_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_match_challenger ON match(challenger_id);
CREATE INDEX idx_match_opponent ON match(opponent_id);
CREATE INDEX idx_match_created ON match(created_at DESC);
```

### MATCH_FRAME

```sql
CREATE TABLE match_frame (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  frame_index   INT NOT NULL,
  state_json    JSONB NOT NULL,

  UNIQUE(match_id, frame_index)
);

CREATE INDEX idx_match_frame_match ON match_frame(match_id);
```

**Structure de state_json:**

```json
{
  "ball": { "x": 50.0, "y": 50.0 },
  "players": [
    { "slot": 1, "team": "challenger", "x": 10.0, "y": 50.0, "state": "idle" },
    { "slot": 2, "team": "challenger", "x": 25.0, "y": 30.0, "state": "moving" },
    // ... 10 joueurs total
  ],
  "events": [
    { "type": "pass", "from": 1, "to": 3 },
    { "type": "goal", "scorer": 5 }
  ]
}
```

---

## Relations

```
UTILISATEUR ──1:N──► SCRIPT_IA
UTILISATEUR ──1:N──► TACTIQUE
TACTIQUE ────1:5──► TACTIQUE_JOUEUR ──N:1──► SCRIPT_IA

MATCH ──► challenger (UTILISATEUR)
MATCH ──► opponent (UTILISATEUR)
MATCH ──► challenger_tactic (TACTIQUE)
MATCH ──► opponent_tactic (TACTIQUE)
MATCH ──1:N──► MATCH_FRAME
```

---

## Volume Estime

| Entite | Volume |
|--------|--------|
| Utilisateur | N users |
| Script_IA | ~10 / user |
| Tactique | ~5 / user |
| Tactique_Joueur | 5 / tactique |
| Match | Illimite |
| Match_Frame | ~300-600 / match |

---

## Decisions Architecturales

| Aspect | Decision |
|--------|----------|
| Mode principal | Multijoueur asynchrone |
| Defi | Unilateral (pas d'acceptation) |
| Points | +3 win / +1 draw / -1 loss |
| Replay | Stocke par frame, recalcul affichage |
| Tactiques systeme | `is_system = TRUE` pour entrainement |
| Scripts | Valides avant sauvegarde (`is_valid`) |
