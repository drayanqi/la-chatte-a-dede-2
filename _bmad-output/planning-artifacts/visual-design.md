# Design Visuel - Lachatadede

> **Statut** : VALIDE par Pelo
> **Date** : 2026-01-19
> **Version** : 1.0

---

## Vue d'Ensemble

Style **semi-réaliste**, **élégant**, **sobre**.
Parquet bicolore (orange/bleu) avec lignes de futsal.

---

## Terrain

### Dimensions

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                      100 unités                                │
│  ◄──────────────────────────────────────────────────────────►  │
│                                                                │
│  ┌──────────────────────┬──────────────────────┐    ▲         │
│  │                      │                      │    │         │
│  │       ORANGE         │         BLEU         │    │ 50      │
│  │       (Home)         │        (Away)        │    │ unités  │
│  │                      │                      │    │         │
│  └──────────────────────┴──────────────────────┘    ▼         │
│                                                                │
└────────────────────────────────────────────────────────────────┘

Ratio: 2:1 (100 x 50)
```

### Parquet

| Propriété | Valeur |
|-----------|--------|
| Style lattes | **Verticales** (parallèles aux buts) |
| Largeur latte | ~2 unités |
| Séparation | **Coupure nette** au centre (x = 50) |
| Texture | Grain de bois subtil |
| Variation | Légère variation de teinte entre lattes |

### Couleurs

```javascript
const COLORS = {
  // Parquet
  orange: {
    base: '#E85D04',
    dark: '#C54D03',      // Ombre entre lattes
    light: '#FF6B0A',     // Reflet subtil
  },
  blue: {
    base: '#0077B6',
    dark: '#005F8A',      // Ombre entre lattes
    light: '#0088CC',     // Reflet subtil
  },

  // Lignes
  lines: '#FFFFFF',
  lineWidth: 0.5,         // En unités du terrain

  // Buts
  goalHome: '#E85D04',    // Orange (même que terrain home)
  goalAway: '#0077B6',    // Bleu (même que terrain away)
};
```

---

## Lignes du Terrain

### Lignes Présentes

| Ligne | Description |
|-------|-------------|
| ✅ Contour | Rectangle extérieur |
| ✅ Ligne médiane | Verticale au centre (x = 50) |
| ✅ Rond central | Cercle au centre, rayon ~8 unités |
| ✅ Surfaces arrondies | Style futsal/handball (voir schéma) |
| ❌ Corners | Non |
| ❌ Point de penalty | Non |

### Surfaces de Réparation (Style Futsal)

```
     Surface Home (arrondie)              Surface Away (arrondie)

     x=0        x=12                      x=88       x=100
      │          │                          │          │
      │    ╭─────╯                          ╰─────╮    │
      │   ╱                                      ╲   │
   ───┼──╱                                        ╲──┼───  y=15
      │ │            ← Zone gardien →              │ │
   ───┼──╲                                        ╱──┼───  y=35
      │   ╲                                      ╱   │
      │    ╰─────╮                          ╭─────╯    │
      │          │                          │          │
```

**Forme** : Arc de cercle (comme au handball)
- Centre de l'arc : Position du but (x=0 ou x=100, y=25)
- Rayon : ~12 unités
- L'arc va de y=15 à y=35

---

## Buts

### Style

| Propriété | Valeur |
|-----------|--------|
| Style | **Minimaliste** |
| Forme | Rectangle simple |
| Couleur | Même que l'équipe (orange/bleu) |
| Profondeur | Non (2D plat) |
| Filet | Non visible |

### Dimensions

```
       ┌───┐
       │   │  ← Poteau (1 unité épaisseur)
   y=35├───┤
       │   │
       │   │  ← Zone de but
       │   │
   y=15├───┤
       │   │
       └───┘

   But Home: x = -2 à 0
   But Away: x = 100 à 102
   Hauteur: y = 15 à 35 (20 unités)
```

### Apparence

```javascript
const GOAL_STYLE = {
  width: 2,           // Profondeur du but (vers l'extérieur)
  postWidth: 0.5,     // Épaisseur des poteaux
  color: {
    home: '#E85D04',  // Orange
    away: '#0077B6',  // Bleu
  },
  opacity: 0.9,
};
```

---

## Joueurs

### Apparence

| Propriété | Valeur |
|-----------|--------|
| Forme | Cercle |
| Rayon | ~2 unités |
| Couleur | Orange (home) / Bleu (away) |
| Numéro | Affiché au centre (blanc) |
| Contour | Blanc, 0.3 unité |

### Indicateur de Possession

| État | Indicateur |
|------|------------|
| A le ballon | Cercle légèrement plus grand + halo subtil |
| Script assigné | Petit point vert en haut à droite |

```javascript
const PLAYER_STYLE = {
  radius: 2,
  colors: {
    home: '#E85D04',
    away: '#0077B6',
  },
  stroke: {
    color: '#FFFFFF',
    width: 0.3,
  },
  number: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  hasBall: {
    glowRadius: 3,
    glowOpacity: 0.3,
  },
  hasScript: {
    dotColor: '#22C55E',
    dotRadius: 0.5,
  },
};
```

---

## Ballon

### Apparence

| Propriété | Valeur |
|-----------|--------|
| Forme | Cercle |
| Rayon | ~1 unité |
| Couleur | Blanc avec motif subtil |
| Contour | Gris foncé |

```javascript
const BALL_STYLE = {
  radius: 1,
  color: '#FFFFFF',
  stroke: {
    color: '#333333',
    width: 0.2,
  },
  pattern: 'pentagon',  // Motif ballon classique (optionnel)
};
```

---

## Schéma Complet

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   ┌─┐                            │                            ┌─┐         │
│   │ │      ╭────────╮            │            ╭────────╮      │ │         │
│   │O│     ╱          ╲           │           ╱          ╲     │B│         │
│   │R│    │            │    ╭─────┼─────╮    │            │    │L│         │
│   │A│    │     ①      │   ╱      │      ╲   │      ②     │    │E│         │
│   │N│    │            │  │   ○   │   ●   │  │            │    │U│         │
│   │G│    │    ③  ④    │   ╲      │      ╱   │    ⑤  ⑥    │    │ │         │
│   │E│    │            │    ╰─────┼─────╯    │            │    │ │         │
│   │ │     ╲          ╱           │           ╲          ╱     │ │         │
│   │ │      ╰────────╯            │            ╰────────╯      │ │         │
│   └─┘                            │                            └─┘         │
│                                                                            │
│  ← ORANGE (Home)                 │               BLEU (Away) →            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

Légende:
  ①②③④⑤⑥ = Joueurs (numéros)
  ○ = Ballon
  ● = Centre terrain
  ╭──╮ = Surface arrondie (futsal)
  │  │ = But (minimaliste)
```

---

## Implémentation PixiJS

### Structure des Layers

```javascript
// Ordre de rendu (back to front)
const layers = [
  'background',     // Parquet (lattes)
  'lines',          // Lignes blanches
  'goals',          // Buts
  'shadows',        // Ombres joueurs (optionnel)
  'ball',           // Ballon
  'players',        // Joueurs
  'ui',             // UI overlay (scores, etc.)
];
```

### Rendu du Parquet

```javascript
function drawParquet(graphics, width, height) {
  const slateWidth = 2;
  const centerX = width / 2;

  for (let x = 0; x < width; x += slateWidth) {
    const isOrangeSide = x < centerX;
    const baseColor = isOrangeSide ? COLORS.orange.base : COLORS.blue.base;
    const darkColor = isOrangeSide ? COLORS.orange.dark : COLORS.blue.dark;

    // Latte principale
    graphics.rect(x, 0, slateWidth - 0.2, height);
    graphics.fill(baseColor);

    // Ligne sombre entre lattes
    graphics.rect(x + slateWidth - 0.2, 0, 0.2, height);
    graphics.fill(darkColor);
  }
}
```

### Rendu Surface Arrondie

```javascript
function drawPenaltyArea(graphics, isHome) {
  const goalX = isHome ? 0 : 100;
  const radius = 12;
  const startAngle = isHome ? -Math.PI/2 : Math.PI/2;
  const endAngle = isHome ? Math.PI/2 : -Math.PI/2;

  graphics.moveTo(goalX, 15);
  graphics.arc(goalX, 25, radius, startAngle, endAngle, !isHome);
  graphics.lineTo(goalX, 35);
  graphics.stroke({ color: COLORS.lines, width: 0.5 });
}
```

---

## Palette Complète

| Élément | Couleur | Hex |
|---------|---------|-----|
| Parquet Orange | Base | `#E85D04` |
| Parquet Orange | Sombre | `#C54D03` |
| Parquet Bleu | Base | `#0077B6` |
| Parquet Bleu | Sombre | `#005F8A` |
| Lignes | Blanc | `#FFFFFF` |
| But Home | Orange | `#E85D04` |
| But Away | Bleu | `#0077B6` |
| Joueurs Home | Orange | `#E85D04` |
| Joueurs Away | Bleu | `#0077B6` |
| Numéros joueurs | Blanc | `#FFFFFF` |
| Ballon | Blanc | `#FFFFFF` |
| Contour ballon | Gris | `#333333` |
| Script assigné | Vert | `#22C55E` |

---

## Résumé

| Aspect | Décision |
|--------|----------|
| Parquet | Lattes verticales, coupure nette |
| Couleurs | Orange (#E85D04) / Bleu (#0077B6) |
| Lignes | Médiane, rond central, surfaces arrondies |
| Surfaces | Style futsal (arc de cercle) |
| Buts | Minimalistes, même couleur que l'équipe |
| Style global | Sobre, élégant, pas surchargé |
