# API Script IA - Lachatadede

> **Statut** : VALIDE par Pelo
> **Date** : 2026-01-19
> **Version** : 2.0 (API Orientee Objet)

---

## Vue d'Ensemble

Chaque joueur execute un script IA a chaque tick de la simulation.
Le script recoit un objet **game** et appelle des **methodes** sur `me`.

```javascript
function update(game) {
  const { me, ball, teammates, opponents, field } = game;

  if (me.hasBall) {
    me.shoot(100, 25, 1.0);
  } else {
    me.moveToward(ball.position.x, ball.position.y);
  }
}
```

---

## Principes

| Regle | Description |
|-------|-------------|
| **Sandboxing** | Le script ne peut pas modifier directement le jeu |
| **Une action par tick** | Seule la PREMIERE action est executee |
| **Actions instantanees** | Pas d'animation, effet immediat |
| **Erreurs visibles** | Actions multiples/invalides = warning visible |
| **Pas de helpers** | Les joueurs codent leurs propres utilitaires |

---

## Objet Game

L'objet `game` fourni au script a chaque tick :

```typescript
interface Game {
  me: Player;           // Le joueur qui execute ce script
  ball: Ball;           // Le ballon
  teammates: Player[];  // Coequipiers (sans soi-meme)
  opponents: Player[];  // Adversaires
  field: Field;         // Terrain
}
```

---

## Player (me, teammates, opponents)

```typescript
interface Player {
  // === PROPRIETES (lecture seule) ===
  position: { x: number, y: number };  // 0-100 pour x, 0-50 pour y
  hasBall: boolean;
  slot: 1 | 2 | 3 | 4 | 5;
  team: 'home' | 'away';

  // === METHODES (actions - seulement sur `me`) ===
  moveToward(x: number, y: number): void;
  dribble(x: number, y: number): void;
  stop(): void;
  shoot(x: number, y: number, power: number): void;
}
```

**Note** : Les methodes d'action ne sont disponibles que sur `me`, pas sur teammates/opponents.

---

## Ball

```typescript
interface Ball {
  position: { x: number, y: number };
  velocity: { vx: number, vy: number };
  owner: string | null;  // playerId ou null si libre
}
```

---

## Field

```typescript
interface Field {
  width: 100;
  height: 50;
  goals: {
    home: { x: 0, y: 25, width: 10 };    // But gauche
    away: { x: 100, y: 25, width: 10 };  // But droite
  };
  zones: {
    homeBox: { x1: 0, y1: 15, x2: 16, y2: 35 };
    awayBox: { x1: 84, y1: 15, x2: 100, y2: 35 };
    center: { x: 50, y: 25 };
  };
}
```

---

## Methodes d'Action

### me.moveToward(x, y)

**Deplacer le joueur vers un point SANS le ballon.**

```javascript
me.moveToward(50, 25);
```

| Parametre | Type | Description |
|-----------|------|-------------|
| x | number | Position X cible (0-100) |
| y | number | Position Y cible (0-50) |

**Comportement :**
- Le joueur se deplace vers (x, y) a vitesse constante
- Si le joueur avait le ballon, **il le perd** (le ballon reste sur place)

---

### me.dribble(x, y)

**Deplacer le joueur vers un point AVEC le ballon.**

```javascript
me.dribble(75, 30);
```

| Parametre | Type | Description |
|-----------|------|-------------|
| x | number | Position X cible (0-100) |
| y | number | Position Y cible (0-50) |

**Comportement :**
- Le joueur se deplace vers (x, y) a vitesse constante
- Le ballon suit le joueur
- **Warning si le joueur n'a pas le ballon**

---

### me.stop()

**Arreter le joueur.**

```javascript
me.stop();
```

**Comportement :**
- Le joueur s'arrete immediatement
- Si le joueur a le ballon, il le garde

---

### me.shoot(x, y, power)

**Frapper le ballon vers une position.**

```javascript
me.shoot(100, 25, 0.8);
```

| Parametre | Type | Description |
|-----------|------|-------------|
| x | number | Position X cible (0-100) |
| y | number | Position Y cible (0-50) |
| power | number | Puissance du tir (0.1 - 1.0) |

**Comportement :**
- Le ballon part en ligne droite vers (x, y)
- Vitesse initiale = power * MAX_BALL_SPEED
- La vitesse decremente a chaque tick (friction)
- Le ballon peut etre intercepte en route
- **Warning si le joueur n'a pas le ballon**

---

## Regles d'Execution

### Une Action par Tick

Si le script appelle plusieurs actions :

```javascript
function update(game) {
  game.me.moveToward(50, 25);  // ✅ Executee
  game.me.shoot(100, 25, 1.0); // ❌ Ignoree + Warning
}
```

- **Premiere action** = executee
- **Actions suivantes** = ignorees + warning visible dans le debugger

### Aucune Action

Si le script n'appelle aucune action, le joueur continue son mouvement precedent (inertie) ou reste immobile.

---

## Possession du Ballon

### Recuperation

| Regle | Description |
|-------|-------------|
| Collision | Un joueur recupere le ballon en le touchant |
| Ballon libre | Premier joueur a toucher = possession |
| Contestation | Si 2 joueurs touchent simultanement, le seed aleatoire decide |

### Perte

| Situation | Resultat |
|-----------|----------|
| `moveToward()` avec ballon | Perd le ballon (reste sur place) |
| `shoot()` | Le ballon part, joueur n'a plus le ballon |
| Adversaire intercepte | Perd le ballon |

---

## Physique du Ballon

```
Vitesse initiale = power * MAX_BALL_SPEED
Vitesse tick N = Vitesse tick N-1 * FRICTION

Constantes:
- MAX_BALL_SPEED = 5.0 unites/tick
- FRICTION = 0.95 (perd 5% de vitesse par tick)
- MIN_BALL_SPEED = 0.1 (en dessous, ballon s'arrete)
```

---

## But

| Regle | Description |
|-------|-------------|
| Condition | Le ballon traverse la ligne de but |
| Zone | y entre 15 et 35 |
| Home marque | Ballon x >= 100 |
| Away marque | Ballon x <= 0 |

---

## Gestion des Erreurs et Warnings

### Warnings (visibles dans debugger)

| Warning | Cause |
|---------|-------|
| `MULTIPLE_ACTIONS` | Plusieurs actions appelees dans un tick |
| `DRIBBLE_NO_BALL` | dribble() sans avoir le ballon |
| `SHOOT_NO_BALL` | shoot() sans avoir le ballon |

### Erreurs (arretent le script)

| Erreur | Cause |
|--------|-------|
| `SCRIPT_TIMEOUT` | Script trop long (>10ms) |
| `SCRIPT_ERROR` | Erreur JS (syntax, runtime) |

---

## Exemples de Scripts

### Attaquant Simple

```javascript
function update(game) {
  const { me, ball, field } = game;
  const goalX = me.team === 'home' ? 100 : 0;

  if (me.hasBall) {
    const distToGoal = Math.abs(me.position.x - goalX);

    if (distToGoal < 30) {
      me.shoot(goalX, 25, 1.0);
    } else {
      me.dribble(goalX, 25);
    }
  } else {
    me.moveToward(ball.position.x, ball.position.y);
  }
}
```

### Defenseur Zone

```javascript
function update(game) {
  const { me, ball, teammates } = game;
  const myZone = { x: 20, y: 15 + me.slot * 7 };

  if (me.hasBall) {
    // Passer vers l'avant
    const target = teammates
      .filter(t => t.position.x > me.position.x)
      .sort((a, b) => b.position.x - a.position.x)[0];

    if (target) {
      me.shoot(target.position.x, target.position.y, 0.6);
    } else {
      me.stop();
    }
  } else {
    // Distance au ballon
    const dist = Math.hypot(
      ball.position.x - me.position.x,
      ball.position.y - me.position.y
    );

    if (dist < 15) {
      me.moveToward(ball.position.x, ball.position.y);
    } else {
      me.moveToward(myZone.x, myZone.y);
    }
  }
}
```

### Gardien

```javascript
function update(game) {
  const { me, ball, teammates } = game;
  const goalX = me.team === 'home' ? 5 : 95;

  if (me.hasBall) {
    const target = teammates
      .sort((a, b) => {
        const distA = Math.abs(a.position.x - 50);
        const distB = Math.abs(b.position.x - 50);
        return distA - distB;
      })[0];

    if (target) {
      me.shoot(target.position.x, target.position.y, 0.8);
    } else {
      me.stop();
    }
  } else {
    // Suivre le ballon en Y, rester sur la ligne
    const targetY = Math.max(15, Math.min(35, ball.position.y));
    me.moveToward(goalX, targetY);
  }
}
```

---

## Constantes du Moteur

| Constante | Valeur | Description |
|-----------|--------|-------------|
| PLAYER_SPEED | 1.0 | Vitesse deplacement joueur |
| MAX_BALL_SPEED | 5.0 | Vitesse max du ballon |
| BALL_FRICTION | 0.95 | Multiplicateur vitesse/tick |
| MIN_BALL_SPEED | 0.1 | Seuil d'arret du ballon |
| COLLISION_RADIUS | 2.0 | Rayon collision joueur-ballon |
| FIELD_WIDTH | 100 | Largeur terrain |
| FIELD_HEIGHT | 50 | Hauteur terrain |
| GOAL_Y_MIN | 15 | Limite basse du but |
| GOAL_Y_MAX | 35 | Limite haute du but |
| TICK_TIMEOUT | 10 | Timeout script en ms |
