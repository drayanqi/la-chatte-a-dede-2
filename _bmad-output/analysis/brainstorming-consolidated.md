---
title: 'Lachatadédé - Brainstorming Consolidé'
date: '2026-01-09 to 2026-01-10'
author: 'Pelo'
version: '2.0'
status: 'complete'
sessions:
  - date: '2026-01-09'
    techniques: ['MDA Framework', 'Player Fantasy Mining']
  - date: '2026-01-10'
    techniques: ['SCAMPER Method', 'Five Whys']
---

# Lachatadédé - AI Football Arena

## Brainstorming Consolidé

**Participant:** Pelo
**Sessions:** 2026-01-09 & 2026-01-10

---

## Concept Principal

Une compétition de programmation où les joueurs codent l'IA d'une équipe de foot indoor 5v5 en JavaScript, puis regardent leur création affronter les AIs d'autres joueurs en temps réel.

| Élément | Description |
|---------|-------------|
| **Genre** | Programming competition / Sports simulation |
| **Inspiration** | Leek Wars meets Football Manager |
| **Style Visuel** | Flat 2D top-down, joueurs circulaires |
| **Physique** | Arcade — simple, prédictible, déterministe |

---

## Player Fantasy

| Fantasy | Expression |
|---------|------------|
| Mastermind Coach | Surpasser les adversaires avec des tactiques supérieures |
| Genius Programmer | Code JavaScript élégant qui domine |
| Scientist | Itérer, tester, faire évoluer l'AI jusqu'à la perfection |
| Competitor | Grimper le classement ranked, gagner des tournois |

---

## MDA Framework

### Aesthetics (Feelings)

| Priorité | Émotion | Delivery |
|----------|---------|----------|
| 1 | Challenge | Compétition contre vrais joueurs |
| 2 | Discovery | Entraînement & optimisation en practice mode |
| 3 | Submission | Regarder l'AI exécuter votre stratégie |

### Dynamics (Behaviors)

| Catégorie | Features |
|-----------|----------|
| Challenge | Ranked matchmaking, Tournois |
| Discovery | Practice vs AI pré-codées (difficulté variable) |
| Submission | Visualisation temps réel, Replay, Slow-mo + debug live |

### Mechanics (Rules & Systems)

| Système | Design |
|---------|--------|
| Contrôle | Comportement individuel par joueur (5 AIs par équipe) |
| Information | API full visibility: score, balle, toutes positions |
| Programmation | JavaScript API (move, shoot, get info, etc.) |
| Exécution | Turn-based: actions simultanées par tick |
| Stats Joueurs | V1: Identiques / V2: Customisables |
| Fin de Match | Limite de temps fixe (3 minutes) |
| Scope | Pas de features communautaires (garder simple) |

---

## Core Loop

```
Code → Test in Practice → Queue Ranked → Watch Result → Analyze → Iterate
```

---

## Décisions Design (SCAMPER)

### Structure du Code

- **Éditeur:** Monaco Editor intégré (moteur VSCode) avec autocomplétion sur l'API
- **Format:** Code libre qui loop automatiquement, pas de boilerplate
- **Perspective:** Chaque joueur = `me`, même code exécuté par chacun
- **PIVOT MAJEUR:** 1 AI assignable par joueur (gardien, défenseur, attaquant)
- **Helpers intelligents:** `me.isClosestToBall()`, `me.role`, `teammates.closest(ball)`, etc.

### Debug & Feedback

- **V1:** Debug panel latéral avec logs couleur-codés par joueur (console.log visible live)
- **V2 future:** Replay synchronisé avec highlight de code ligne par ligne

### Match & Terrain

- **Durée match:** 3 minutes
- **Équipe:** 5v5 confirmé
- **Terrain:** Joli visuellement + murs rebondissants style hockey (sans arrière des cages)
- **Physique:** Réaliste et déterministe (angle = angle, pas de random)

### Features Sociales

- **Chat:** Garder
- **Historique:** 10 derniers matchs
- **Profils:** Publics et visibles
- **Leaderboard:** Indispensable
- **Fork public:** Non, code reste secret
- **Duplication d'AIs:** Oui, pour versioning simple

### Philosophie Produit

- **Focus:** Jeu fun compétitif uniquement, pas d'usage éducatif/recrutement
- **Puzzles quotidiens:** Non (format incompatible avec écriture d'AI)
- **Tournois thématiques:** Plus tard, style Kaggle

---

## Insight Racine (Five Whys)

**Sujet:** Le modèle de code par joueur

| Why | Question | Réponse |
|-----|----------|---------|
| 1 | Pourquoi 1 AI par joueur? | Code plus simple par rôle |
| 2 | Pourquoi code simple = mieux? | Chaque comportement est focalisé et lisible |
| 3 | Pourquoi la simplicité compte? | Simple = facile à améliorer |
| 4 | Pourquoi l'itération rapide = fun? | 2h de friction = joueur perdu |
| 5 | Pourquoi Lachatadédé sera plus rapide? | Test live instantané contre AIs d'entraînement |

**Avantage Compétitif:** Feedback loop ultra-court
> Idée → Code → Test live → Résultat visible → Itère (en secondes, pas en minutes)

---

## Décisions Validées

| Feature | Justification |
|---------|---------------|
| Monaco Editor | Autocomplétion = code plus vite |
| 1 AI par rôle | Fichiers courts = modifs rapides |
| Debug panel live | Feedback immédiat pendant le match |
| AIs d'entraînement multi-niveau | Test instantané sans queue ranked |
| Physique déterministe | Compétitif équitable, skill > chance |

---

## Thèmes & Patterns

- **Mastery through iteration** — Le core loop emphasize l'amélioration continue
- **Strategic expression** — Code comme médium pour la créativité tactique
- **Competitive validation** — Prouver son AI contre de vrais adversaires
- **Transparency** — Full information, physique déterministe, compétition équitable

---

## Questions Ouvertes

- Tick rate / temps par tick?
- API method specifics (quelles actions disponibles)?
- Système de ranking/Elo?
- Structure des tournois?
- Niveaux de difficulté des AIs d'entraînement?
- Détails des outils de debug/visualisation?

---

## Prochaines Étapes Recommandées

1. **Définir l'API JavaScript** — Lister toutes les méthodes disponibles (`me.move()`, `ball.getPosition()`, etc.)
2. **Prototyper Monaco Editor** — Tester l'intégration avec autocomplétion custom
3. **Designer les AIs d'entraînement** — Définir les niveaux de difficulté
4. **Prototyper le tick system** — Build une simulation tick-based minimale

---

## Historique des Sessions

### Session 1 (2026-01-09)
- **Techniques:** MDA Framework, Player Fantasy Mining
- **Output:** Concept de base, fantasies joueur, analyse MDA, core loop

### Session 2 (2026-01-10)
- **Techniques:** SCAMPER Method, Five Whys
- **Output:** Pivot 1 AI/joueur, avantage compétitif clarifié, 12+ décisions design
