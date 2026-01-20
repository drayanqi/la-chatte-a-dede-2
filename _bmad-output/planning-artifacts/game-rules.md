# Regles du Jeu - Lachatadede

> **Statut** : VALIDE par Pelo
> **Date** : 2026-01-19
> **Version** : 1.0

---

## Vue d'Ensemble

Lachatadede est un jeu de futsal **5v5 arcade** ou des scripts IA controlent les joueurs.
Les regles sont simplifiees pour favoriser le fun et la strategie algorithmique.

---

## Format

| Element | Valeur |
|---------|--------|
| Joueurs | 5 vs 5 |
| Terrain | 100 x 50 unites (ratio 2:1) |
| Style | Arcade (pas de simulation realiste) |

---

## Duree

| Parametre | Valeur |
|-----------|--------|
| Duree | **3 minutes** |
| Frames | ~10 800 frames (a 60 fps) |
| Mi-temps | Non |
| Prolongations | Non |
| Egalite | **Possible** (match nul) |

---

## Debut de Match

### Engagement Initial (Kickoff)

| Regle | Description |
|-------|-------------|
| Qui engage | **Aleatoire** (determine par le seed) |
| Position joueurs | Positions initiales definies dans la tactique |
| Position ballon | Centre du terrain (50, 25) |
| Restriction | Adversaires hors du rond central |

### Deroulement

1. Joueurs places a leurs positions initiales
2. Ballon au centre
3. Equipe designee (aleatoire) a le ballon
4. Simulation demarre

---

## Apres un But

| Etape | Description |
|-------|-------------|
| 1 | Animation/pause courte (optionnel) |
| 2 | Score mis a jour |
| 3 | **Tous les joueurs** reviennent a leur position initiale |
| 4 | **Equipe qui a encaisse** engage |
| 5 | Ballon au centre |
| 6 | Adversaires hors du rond central |
| 7 | Reprise du jeu |

---

## Limites du Terrain

### Bords Lateraux (Touches)

| Regle | Comportement |
|-------|--------------|
| Ballon atteint y=0 ou y=50 | **Rebondit** |
| Angle de rebond | Reflexion (vy = -vy) |
| Pas de touche | Le jeu continue |

### Lignes de But (Hors Goal)

| Regle | Comportement |
|-------|--------------|
| Ballon atteint x=0 ou x=100 (hors but) | **Rebondit** |
| Angle de rebond | Reflexion (vx = -vx) |
| Pas de corner | Le jeu continue |
| Pas de 6 metres | Le jeu continue |

### Zone de But

| Regle | Comportement |
|-------|--------------|
| Ballon x <= 0 ET y entre 15-35 | **BUT pour Away** |
| Ballon x >= 100 ET y entre 15-35 | **BUT pour Home** |

---

## Physique

### Joueurs

| Parametre | Valeur |
|-----------|--------|
| Vitesse | Constante (PLAYER_SPEED = 1.0) |
| Collisions entre joueurs | **Non** (se traversent) |
| Acceleration | Non (vitesse immediate) |

### Ballon

| Parametre | Valeur |
|-----------|--------|
| Vitesse max | MAX_BALL_SPEED = 5.0 |
| Friction | 0.95 par tick |
| Vitesse min | 0.1 (en dessous = arret) |
| Rebonds | Oui (bords et lignes de but) |
| Hauteur | Non (2D pur, toujours au sol) |

### Possession

| Situation | Regle |
|-----------|-------|
| Joueur touche ballon libre | Recupere la possession |
| 2 joueurs touchent en meme temps | Seed aleatoire decide |
| Joueur fait moveToward() avec ballon | Perd le ballon |
| Joueur fait shoot() | Ballon part, perd possession |

---

## Regles Absentes (Simplification)

| Regle Classique | Dans Lachatadede |
|-----------------|------------------|
| Hors-jeu | **Non** |
| Fautes | **Non** |
| Cartons | **Non** |
| Coups francs | **Non** |
| Penalties | **Non** |
| Corners | **Non** |
| Touches | **Non** (rebond) |
| 6 metres | **Non** (rebond) |
| Mi-temps | **Non** |
| Prolongations | **Non** |
| Tirs au but | **Non** |

---

## Fin de Match

### Conditions de Fin

| Condition | Resultat |
|-----------|----------|
| 3 minutes ecoulees | Match termine |
| Score A > Score B | Victoire A |
| Score A < Score B | Victoire B |
| Score A = Score B | **Match nul** |

### Points Attribues

| Resultat | Challenger | Opponent |
|----------|------------|----------|
| Victoire | +3 | -1 |
| Match nul | +1 | +1 |
| Defaite | -1 | +3 |

---

## Constantes du Moteur

```javascript
const GAME_RULES = {
  // Duree
  MATCH_DURATION_SECONDS: 180,      // 3 minutes
  TICKS_PER_SECOND: 60,
  TOTAL_TICKS: 10800,               // 180 * 60

  // Terrain
  FIELD_WIDTH: 100,
  FIELD_HEIGHT: 50,

  // Buts
  GOAL_Y_MIN: 15,
  GOAL_Y_MAX: 35,
  GOAL_WIDTH: 20,                   // 35 - 15

  // Rond central (pour engagement)
  CENTER_CIRCLE_RADIUS: 10,
  CENTER_X: 50,
  CENTER_Y: 25,

  // Joueurs
  PLAYER_SPEED: 1.0,
  PLAYERS_PER_TEAM: 5,

  // Ballon
  MAX_BALL_SPEED: 5.0,
  BALL_FRICTION: 0.95,
  MIN_BALL_SPEED: 0.1,
  COLLISION_RADIUS: 2.0,

  // Points
  POINTS_WIN: 3,
  POINTS_DRAW: 1,
  POINTS_LOSS: -1,
};
```

---

## Sequence de Jeu

```
┌─────────────────────────────────────────────┐
│            INITIALISATION                   │
│  - Charger tactiques (home + away)          │
│  - Placer joueurs aux positions initiales   │
│  - Ballon au centre                         │
│  - Tirer au sort qui engage (seed)          │
└─────────────────────┬───────────────────────┘
                      ▼
┌─────────────────────────────────────────────┐
│            BOUCLE DE JEU                    │
│  Pour chaque tick (0 a 10799):              │
│                                             │
│  1. Shuffle ordre des joueurs (seed)        │
│  2. Pour chaque joueur:                     │
│     - Executer son script IA                │
│     - Collecter son action                  │
│  3. Appliquer les actions                   │
│  4. Mettre a jour positions                 │
│  5. Verifier collisions ballon              │
│  6. Verifier rebonds sur bords              │
│  7. Verifier si but                         │
│     - Si but: reset positions, engagement   │
│  8. Sauvegarder frame                       │
└─────────────────────┬───────────────────────┘
                      ▼
┌─────────────────────────────────────────────┐
│            FIN DE MATCH                     │
│  - Calculer resultat                        │
│  - Attribuer points                         │
│  - Sauvegarder simulation                   │
└─────────────────────────────────────────────┘
```

---

## Engagement Apres But

```
┌─────────────────────────────────────────────┐
│  BUT MARQUE                                 │
│  - Equipe A marque contre Equipe B          │
└─────────────────────┬───────────────────────┘
                      ▼
┌─────────────────────────────────────────────┐
│  RESET                                      │
│  - Tous joueurs → positions initiales       │
│  - Ballon → centre (50, 25)                 │
│  - Equipe B recoit le ballon                │
└─────────────────────┬───────────────────────┘
                      ▼
┌─────────────────────────────────────────────┐
│  VERIFICATION ROND CENTRAL                  │
│  - Joueurs Equipe A hors du cercle          │
│  - (rayon 10 autour du centre)              │
│  - Si dedans: repousses au bord du cercle   │
└─────────────────────┬───────────────────────┘
                      ▼
┌─────────────────────────────────────────────┐
│  REPRISE                                    │
│  - Jeu continue                             │
└─────────────────────────────────────────────┘
```

---

## Rebonds

### Rebond Lateral (y = 0 ou y = 50)

```
Avant:  ball.velocity = { vx: 3, vy: 2 }
        ball.position atteint y = 0

Apres:  ball.velocity = { vx: 3, vy: -2 }  // vy inverse
        ball.position.y = 0.1              // legerement inside
```

### Rebond Ligne de But (x = 0 ou x = 100, hors but)

```
Avant:  ball.velocity = { vx: 4, vy: 1 }
        ball.position atteint x = 100
        ball.position.y = 10  // hors zone but (15-35)

Apres:  ball.velocity = { vx: -4, vy: 1 }  // vx inverse
        ball.position.x = 99.9             // legerement inside
```

---

## Resume des Decisions

| Question | Reponse |
|----------|---------|
| Duree | 3 minutes fixes |
| Egalite | Possible |
| Qui engage au debut | Aleatoire (seed) |
| Apres but | Equipe qui encaisse engage |
| Reset apres but | Oui, tous aux positions initiales |
| Touches | Non, rebond |
| Corners | Non, rebond |
| Collisions joueurs | Non, se traversent |
| Fautes | Non |
| Hors-jeu | Non |
