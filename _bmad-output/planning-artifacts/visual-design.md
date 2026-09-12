# Design Visuel - Lachatadede

> **Statut** : PROPOSITION v2 — "Deep Court" (Epic 5.1) implémentée, en attente de validation visuelle par Pelo
> **Date** : 2026-09-12
> **Version** : 2.0

---

## Vue d'Ensemble

Style **arcade**, **coloré**, **lisible d'abord**.
Direction "Wild Card" (Epic 5) : arène sombre à deux moitiés teintées, watermark central, joueurs Rocket League.
La v1 (parquet orange/bleu) n'a jamais été implémentée et est retirée de l'histoire.

---

## Terrain (implémenté — story 5.1)

| Zone | Traitement | Hex / Valeur |
|------|-----------|--------------|
| Letterbox hors-jeu | Plein, tout le canvas | `#111a24` |
| Base du terrain | Plein (spec UX "DevTools meets ESPN") | `#1a2634` |
| Moitié Home | Lueur orange en dégradé, but → centre (alpha 0.32 → 0.10 → 0) | `#ff6b1a` |
| Moitié Away | Lueur bleue en dégradé, but → centre (alpha 0 → 0.10 → 0.32) | `#1a8cff` |
| Lignes | Blanc haute-contraste, 2px | `#ffffff` |
| Rond central | Double anneau (principal 2px + halo 1px alpha 0.25, ×1.3) | `#ffffff` |
| Surfaces | **Arcs futsal** (D, rayon 22 % hauteur) — les rectangles sont retirés | `#ffffff` |
| Bordure | **Coins arrondis** (rayon `max(8, 4 % hauteur)`) | `#ffffff` |
| Base + lueurs | Demi-terrains en chemins arrondis (les lueurs remplissent les coins) | — |
| Boards | Cadre de tribune discret **arrondi** (1px, alpha 0.15, hors buts/halos) | `#ffffff` |
| Branding letterbox | Wordmark `LACHATADEDE` haut + bas (blanc, alpha 0.16, espacé, taille plafonnée à la bande) — masqué si bande trop étroite | `#ffffff` |
| Buts | Cadre arrondi d'équipe (2.5px) **hors terrain**, filet blanc (alpha 0.22), halo équipe (alpha 0.18), poteaux blancs à la bouche | `#ff6b1a` / `#1a8cff` |
| Profondeur des buts | `max(16, 5.5% hauteur)` — dimensionnée pour que le ballon (Ø ≈ 2 % hauteur) tienne dans le filet | — |

**Lois (non négociables) :**
1. Deux moitiés d'équipe distinctes, lisibles instantanément.
2. Les couleurs d'équipe ne peignent jamais le sol sous les joueurs — lueurs subtiles seulement.
3. `fieldGeometry.ts` (mapping pourcent↔écran, rect 2:1) reste intouché.
4. **Moins d'angles droits** (loi Pelo) — chaque nouvelle surface suit le langage arrondi (terrain, buts, boards).

**Implémentation** : un seul bloc de constantes dans `Field.ts` (v1 hardcodée — pas de système de thème, décision Pelo).

---

## Watermark (story 5.2 — implémenté)

`src/assets/watermark.png` (512×512, fond transparent vérifié) — DD et le chat ("La Chat' à Didier Deschamps").
Sprite centré à (50, 50) %, 60 % de la hauteur du terrain, **alpha 0.3**, calqué ENTRE le sol et les lignes.
Chargement async (`Assets.load`), fallback silencieux sans watermark, re-layout au resize.

---

## Joueurs (mis à jour — story 5.1)

| Élément | Valeur |
|---------|--------|
| Home | `#ff6b1a` (orange), anneau blanc |
| Away | `#1a8cff` (bleu), anneau blanc |
| Sélection | Anneau épais `#fbbf24` (jaune) |
| Script assigné | Point vert `#22c55e` (contour blanc) |
| Numéro | Blanc, centré, suit le rayon du sprite |

---

## Roadmap

| Story | Contenu | Statut |
|-------|---------|--------|
| 5.1 | Terrain bicolore hardcodé | ✅ Implémenté (amendé : dégradés, arcs, double anneau, boards) |
| 5.2 | Watermark central | ✅ Implémenté (à re-vérifier sur le sol bicolore) |
| 5.3 | Pattern de surface (rayures / hexagones / grain) | À faire |
| 5.4 | Teintes de territoire + accents de zone | 🔶 Lueurs dégradées + buts refondus livrés en avance (reste : ombres joueurs, accents de zone) |
| 5.5 | Motion arène (cercle central pulsant, moments de but) | À faire |
| 5.6 | Rendre le ballon (statique puis replay via ballFrames) | Proposé — dimensionné : buts déjà à la bonne profondeur |

---

## Résumé

| Aspect | Décision |
|--------|----------|
| Direction | "Wild Card" — arcade coloré, lisibilité d'abord |
| Sol | Base sombre + lueurs d'équipe (jamais de peinture pleine) |
| Marquage | Blanc haute-contraste |
| Buts | Couleurs d'équipe |
| Watermark | DD & le chat, alpha 0.3, sous les lignes |
