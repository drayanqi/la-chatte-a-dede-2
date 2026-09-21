---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 7.3: Canvas — Habillage léger du terrain existant (adapt, don't rebuild)

Status: done

## Story

As a player,
I want the real pitch to look like the mockups' arena (vertical stripes, visible walls, Deschamps at center) without changing how it plays or how it's built,
So that the game gains charm with zero regression risk on the canvas.

## Acceptance Criteria

1. **Given** the existing `Field.ts` (palette `FIELD_PALETTE`, watermark sprite, half-washes, boards) and `PlayerSprite`, **When** the story ships, **Then** ONLY these visuals change: pitch background becomes vertical green stripes (two green tones replacing the navy `pitchBase`), pitch walls are visible (a dark band + white line running the full border), the DD mascot sits at the center circle, and players get the polished circle treatment (subtle gradient, white ring, ground shadow, bold number).
2. **Given** everything else in the canvas, **When** reviewed, **Then** goals/cages, lines, surfaces, letterbox boards, `fieldGeometry`, ball, trails, drag interactions and the Game loop are untouched — no re-architecture, palette stays centralized in `FIELD_PALETTE` and ready to receive per-team colors (7.4).
3. **Given** light and dark app themes, **When** the pitch renders, **Then** the green tones stay readable in both (stripes are theme-stable; the letterbox keeps the boards' current behavior).

## Scope Boundary (read first)

- Source of truth: mockup v4 `s-equipes` pitch — `.pitch` repeating vertical stripes, `.walls` inset dark band + white line, `.blason` white disc + watermark, `.pnum` polished circle.
- The two half-wash gradients (home/away) are REMOVED as part of the background treatment change — the mockup pitch has no half washes, and per-team colors belong on players/goals/accents only (Epic 5.1 law). `homeHalf`/`awayHalf` palette entries stay (reused by goal accents) but no longer paint the floor.
- Center mascot: white disc (alpha ~0.94) sized ~7% of pitch width with the watermark at ~85% of the disc, centered on the center circle, replacing the giant faint watermark.
- Player treatment: ground shadow ellipse under the circle, white ring stroke, subtle radial highlight (lighter top-left), bold number with soft drop shadow. Selection ring (sun) unchanged.
- Stripe geometry: alternate bands across the pitch width (8 periods), clipped to the rounded pitch rect, theme-stable greens.

## Tasks / Subtasks

- [x] Task 1: `FIELD_PALETTE` (Field.ts) — add `pitchStripeLight: 0x3fae62`, `pitchStripeDark: 0x379c56`, `wallBand: 0x0a140e` (alpha ~0.16), `wallLine: 0xffffff` (alpha ~0.42), `mascotDisc: 0xffffff` (alpha ~0.94); keep every other entry
- [x] Task 2: Field background — replace `pitchBase` fill with alternating vertical stripe rects clipped to the rounded pitch shape; remove the two half-wash gradients
- [x] Task 3: Field walls — full-border dark band + white line (stroke layers inside the pitch border, mimicking `.walls` inset shadow)
- [x] Task 4: Center mascot — white disc + watermark sprite centered in the center circle (replaces the 60%-height faint watermark; keep async `Assets.load` + hidden-until-loaded)
- [x] Task 5: `PlayerSprite` (Player.ts) — polished circle: ground shadow ellipse, white ring, radial highlight gradient, bold number with drop shadow; hit-test/drag/selection behavior unchanged; unit tests updated
- [x] Task 6: Unit tests — `field.test.ts` (stripes/walls/mascot palette + geometry invariants), `player-colors.test.ts` (visual structure), full existing suite stays green

## Verification

- `npx tsc -b`, `npm run lint`, `npm run test:unit` green
- E2E `practice-match.spec.ts` (chromium) green — proves canvas behavior untouched
- Manual: pitch reads as striped green arena with walls + center mascot in both themes; drag/selection/practice match unchanged

## Dev Agent Record

### Completion notes

- Stripe geometry copied from the mockup `.pitch` rule: 78px equal bands (light first at the left edge), not an 8-period split. Light bands are a dedicated `stripes` Graphics masked by a rounded-rect `stripesMask` (mask's own fill = stripe-dark so its render is invisible against the base).
- Walls mimic `.walls` inset shadow with two centered strokes: 6px `wallBand` @0.16 covering 0–6px inside the border, 3px `wallLine` @0.42 covering 6–9px.
- Mascot: white disc @0.94, diameter = min(7% of pitch width, 54% of the center circle diameter) — the 7% figure always wins on a 2:1 pitch, the cap only guards degenerate rects. Watermark sprite resized to 85% of the disc, full opacity (mockup `.blason img`), async load + hidden-until-loaded kept.
- PlayerSprite: stepped highlight/shade fills instead of a radial gradient — at radius ≈13px (360/27 default canvas) a real gradient is indistinguishable and per-sprite FillGradients are pure churn. Ground shadow ellipse 30:10 under the circle, number drop shadow via TextStyle. Selection ring/drag/hit-test untouched.
- The old half-wash gradients, `traceHalfPitch`, `rgba()` helper and `FillGradient` import are gone; `dispose()` kept (Game.destroy calls it) as a clear-only lifecycle hook for 7.4.
- Verified: `rtk tsc -b` ✓, eslint 0 errors, `npm run test:unit` 554/554 ✓ (8 new/updated habillage tests), `practice-match.spec` 8/8 chromium ✓.

### Review fixes (Pelo, 2026-09-21)

- Players washed out: the two-step translucent highlight desaturated the whole circle → real radial `FillGradient`s (highlight at 32%/26% fading by 45%, bottom inner shade from below), clipped to the circle; stepped fills remain as the jsdom/no-canvas fallback (`CANVAS_2D_SUPPORTED` guard). Number weight 800.
- Center bug: the mascot disc was painted into the `background` layer *below* the stripes (light band covered it) → dedicated `mascot` Graphics above the markings (mockup: the center circle passes behind the blason); watermark scaled contain-fit (`max(width, height)` of the texture).
- Double lines: removed the faint 1.3× outer center circle and the old pitch-edge border stroke — the wall's white line is the border, as in the mockup.
- Walls partially hidden: wall strokes lived in `background` under the masked stripes → moved to the markings layer (above stripes).
- Center follow-up (Pelo): white disc removed entirely (`mascotDisc` palette entry dropped) — the watermark image stands alone, contain-fit in 80% of the center circle (a crest painted on a real pitch).

## File List

- `src/components/canvas/engine/Field.ts` (palette + stripes + walls + mascot)
- `src/components/canvas/engine/Player.ts` (ground shadow, highlight, inner shade, number shadow)
- `tests/unit/field.test.ts`, `tests/unit/components/player-colors.test.ts`

## Change Log

- 2026-09-21: Story implemented (habillage only — goals/lines/surfaces/letterbox/fieldGeometry/ball/Game loop untouched).
