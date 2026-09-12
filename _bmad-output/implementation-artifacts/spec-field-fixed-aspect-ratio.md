---
title: 'Fixed-Aspect-Ratio Football Pitch (Futsal 2:1)'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_commit: '7c4d25d118319d22fb3c755e344e6f495f667548'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The pitch rectangle is drawn to fill the whole canvas minus a 40px padding (`Field.draw()`), and the percent→screen mapping matches that rect. Resizing the window or dragging/collapsing side panels changes the canvas shape, so the pitch stretches non-uniformly and player spacing distorts.

**Approach:** Letterbox the pitch: compute a pitch rect that keeps a fixed futsal aspect ratio (40m × 20m → 2:1), scaled to fit ("contain") inside the canvas with a 40px margin, centered in the leftover space. All drawing and all percent↔screen conversions derive from that single pitch rect. Grass fills the entire canvas so letterbox areas read as out-of-play grass. Player sprites scale with the pitch (radius = pitch height / 27, floored at 8px) so gameplay proportions hold at every canvas size; at the 800×600 default this renders ≈13.3px — 1.5× smaller than the previous fixed 20px (human renegotiation, review loop 2). (No ball sprite is rendered by the engine — `TacticData.ball` is data-only — so there is nothing to scale for the ball; adding one is out of scope.)

## Boundaries & Constraints

**Always:**
- Pitch rect aspect ratio is exactly 2:1 (width:height) at every canvas size.
- Pitch is centered both axes in the available area (canvas minus 40px margin on all sides), i.e. `(50, 50)` percent always maps to the canvas center.
- One source of truth for the geometry: a new dependency-free module (no pixi.js imports) exporting `PITCH_ASPECT_RATIO`, `FIELD_PADDING`, a `computePitchRect(canvasWidth, canvasHeight)` and the two converters. `Field` and `PlayerSprite` must consume it — no local re-implementations left in `Field.ts` or `Player.ts`.
- Existing stored percent positions (0–100 × 0–100) keep their meaning (percent of pitch), so saved tactics remain valid without migration.
- `screenToPercent` keeps returning out-of-range values (<0, >100) for points outside the pitch rect — do not clamp.
- Grass color background covers the entire canvas at any size.
- Player sprite radius derives from the pitch rect: `max(8, pitch.height / 27)` — no upper cap. Number label font size and script-indicator dot scale with the radius (floors: 10px font, 2px dot). At the 800×600 default the radius is ≈13.33px — 1.5× smaller than the legacy fixed 20px.
- `screenToPercent` on a zero-size (degenerate) pitch rect returns `{ x: 0, y: 0 }` — never NaN/Infinity.

**Ask First:** If any test or consumer of the converters reveals a behavior this plan would break beyond the geometry itself (e.g. drag-and-drop hit logic), HALT and ask.

**Never:**
- No camera/zoom/pan, no scrollbars, no extra UI controls.
- No changes to `TacticsCanvas.tsx` resize plumbing (ResizeObserver → `Game.resize()` already works).
- No change to the Pixi renderer init size or `Game.ts` `DEFAULT_CONFIG`.
- Do not clamp player positions or alter the `Position` percent type.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default canvas | canvas 800×600 | pitch rect = 720×360 at (40, 120); ratio 2.0; grass covers full 800×600 | N/A |
| Wide canvas | canvas 1600×500 | height-limited: pitch = 840×420 at (380, 40); ratio 2.0 | N/A |
| Narrow panel | user drags left/right divider so center panel shrinks | pitch scales down, ratio stays 2.0, stays centered; players reposition onto new rect | N/A |
| Degenerate canvas | canvas ≤ 80×80 (available ≤ 0 in a dimension) | pitch width/height clamps to 0; no negative dimensions; no crash | clamp, never throw |
| Point outside pitch | `screenToPercent(0, 0)` on 800×600 | x < 0 and y < 0 (percent relative to pitch rect) | unclamped, as today |
| Roundtrip | any percent (x, y) → screen → percent | identity (within float epsilon) | N/A |
| Player scaling | canvas 800×600 / 400×300 / collapsed-panel tiny | radius = max(8, pitch.height/27): ≈13.33px / 8px floor / 8px floor; labels + indicator scale with it | floors keep sprites visible and clickable |
| Fit tie boundary | canvas 840×460 (available exactly 2:1) | pitch = 760×380 at (40, 40); width- and height-limit agree | N/A |
| Odd canvas size | canvas 801×600 | pitch = 721×360.5 at (40, 119.75); ratio still exactly 2.0; margins ≥ 40px | fractional rects are valid |

</frozen-after-approval>

## Code Map

- `src/components/canvas/engine/Field.ts` -- pitch drawing (`draw()` lines 29–87) + duplicated converters (98–121); the distortion source.
- `src/components/canvas/engine/Player.ts` -- duplicated `percentToScreen` (124–133) used by `updatePosition`/`updateFromState`.
- `src/components/canvas/engine/Game.ts` -- creates Field (75), fans out `resize()` to renderer/field/players (282–292); no changes expected.
- `src/components/canvas/TacticsCanvas.tsx` -- ResizeObserver → `game.resize()` (141–150); no changes.
- `tests/unit/field.test.ts` -- currently re-implements the converter math locally (15–42); hardcodes 720×520 expectations (246–252).
- `tests/e2e/tactic-tabs.spec.ts` -- hardcodes `40 + (x/100) * (canvasBox.width - 80)` drop-target math at ~96–99 and ~171–176.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/canvas/engine/fieldGeometry.ts` -- NEW: export `FIELD_PADDING = 40`, `PITCH_ASPECT_RATIO = 2`, `PitchRect` interface, `computePitchRect(w, h)` (contain-fit into `w-80`/`h-80`, centered, clamp to ≥0), `percentToScreen(pitchRect, x, y)`, `screenToPercent(pitchRect, sx, sy)`. Pure math, zero imports -- so unit and e2e tests can import it directly.
- [x] `src/components/canvas/engine/Field.ts` -- replace all three local `padding = 40` blocks and the fill-everything `draw()` with `computePitchRect`: grass rect over the full canvas, white markings (border, halfway line, center circle/spot, penalty boxes, goals) inside the pitch rect; converters delegate to the module -- single geometry source.
- [x] `src/components/canvas/engine/Player.ts` -- delete local `percentToScreen` (124–133); call the module's converter with the module's `computePitchRect(this.screenWidth, this.screenHeight)`. Replace the fixed `RADIUS = 20` with a pitch-derived radius (`max(8, pitch.height / 27)`, helper exported from `fieldGeometry.ts`) used by `drawCircle`, the script indicator, and `containsPoint`; scale the number label font size and indicator dot with the radius (floors 10px / 2px).
- [x] `tests/unit/field.test.ts` -- import the real module instead of the local re-implementation; cover the I/O matrix: 800×600 expectations, 1600×500 wide case, ratio === 2 across several sizes, degenerate 80×80 clamp, out-of-range `screenToPercent`, roundtrip cases (keep existing roundtrip suites); add fit tie-boundary (840×460), odd size (801×600), zero-rect `screenToPercent` finiteness, and player-radius scaling cases (≈13.33px at default, 8px floor, proportional growth).
- [x] `tests/e2e/tactic-tabs.spec.ts` -- replace both hardcoded drop-target computations with `computePitchRect(canvasBox.width, canvasBox.height)` + `percentToScreen` (import from `fieldGeometry.ts`).

**Acceptance Criteria:**
- Given any canvas size and panel arrangement, when the pitch is drawn, then its rect ratio is exactly 2:1, it is centered in the canvas with a ≥40px margin on every side, and grass covers the whole canvas.
- Given the user drags a panel divider or collapses a side panel, when the canvas resizes, then the pitch keeps ratio 2:1 and stays centered, and every player sprite keeps its stored percent position mapped onto the new pitch rect (no distortion of relative spacing).
- Given a tactic saved before this change, when it loads, then player positions render at the same percent locations on the pitch (no data migration).
- Given any canvas size, when player sprites are drawn, then each sprite's radius is `max(8, pitch.height / 27)` (≈13.33px at the 800×600 default — 1.5× smaller than the legacy 20px), and the number label and script indicator scale proportionally; hit detection uses the scaled radius.
- Given `npm run test:unit` and `npm run build`, when run, then all tests pass and TypeScript compiles with no errors.

## Spec Change Log

### 2026-09-12 — human renegotiation + review triage (loop 1)

- **Trigger:** during step-04 review the human added: player (and ball) size must scale with the pitch, otherwise gameplay proportions break. The engine renders no ball sprite (`TacticData.ball` is data-only), so ball scaling is a no-op; adding a rendered ball is deferred.
- **Amended:** frozen Approach/Always/I-O-matrix/ACs plus the Player.ts and unit-test tasks — player radius = `max(8, pitch.height / 18)` derived from the pitch rect; labels and script indicator scale with it.
- **Known-bad state avoided:** fixed 20px sprites on a scaled pitch (disproportionate gameplay at panel extremes); NaN/Infinity percents from `screenToPercent` on degenerate canvases.
- **KEEP:** `fieldGeometry.ts` as the single pure-math source of truth; default 800×600 rendering pixel-identical to the pre-change look (radius 20px, fontSize 14, indicator dot 6); `screenToPercent` stays unclamped for out-of-pitch points (zero-rect guard returns `{0,0}`).
- **Review patches folded in:** zero-rect guard + tie-boundary (840×460) / odd-size (801×600) / degenerate-conversion tests; `baseline_commit` refreshed to `7c4d25d` (panels commit landed after the original baseline was captured).

### 2026-09-12 — review loop 2 patches + second human renegotiation

- **Trigger:** blind-hunter round 2 found: ghost center-spot drawn on degenerate 0×0 pitches; no floor on number font / script dot at the 8px radius floor; roundtrip tests covered only the default rect. Then the human tweaked: "make the size of the players 1.5 times smaller".
- **Amended:** `Field.draw()` early-returns after the grass fill when the pitch rect is 0-sized; player label/dot floors (10px font, 2px dot) added in `Player.ts`; roundtrip suites now loop over default, fractional (801×600) and wide (1600×500) rects; `PLAYER_RADIUS_RATIO` changed from 1/18 to 1/27 (default radius 20px → ≈13.33px) across frozen Approach/Always/I-O-matrix/AC/tasks and tests.
- **Known-bad state avoided:** a lone white dot floating on empty tiny canvases; illegible sub-6px labels when the radius floor engages; roundtrip regressions on non-default letterboxed sizes; keeping 1/18 would have ignored the human's sizing decision.
- **KEEP:** proportionality with no upper cap (capping would reintroduce the gameplay distortion the renegotiation exists to fix); the 8px radius floor for usability; hover state preserved through resize redraws.

## Design Notes

Contain-fit math (the whole algorithm):

```ts
const availW = canvasW - FIELD_PADDING * 2;
const availH = canvasH - FIELD_PADDING * 2;
let w = availW;
let h = w / PITCH_ASPECT_RATIO;        // 2:1 → h = w/2
if (h > availH) { h = availH; w = h * PITCH_ASPECT_RATIO; }
return { x: FIELD_PADDING + (availW - w) / 2, y: FIELD_PADDING + (availH - h) / 2, width: w, height: h };
```

Marking proportions stay relative to the pitch rect (e.g. circle radius `0.15 * min(pitchW, pitchH)`, box `0.2 × pitchW` wide), so markings scale with the pitch and inherit the fixed ratio automatically. Percent mapping now spans the pitch rect, not the padded canvas: `screen.x = rect.x + (x / 100) * rect.width`.

## Verification

**Commands:**
- `npx vitest run tests/unit/field.test.ts` -- expected: all pass, including new ratio/letterbox cases
- `npm run test:unit` -- expected: full unit suite passes
- `npm run build` -- expected: `tsc -b` + vite build succeed
- `npm run lint` -- expected: no new ESLint errors
- `npx playwright test tests/e2e/tactic-tabs.spec.ts` -- expected: drag-and-drop e2e passes with updated drop-target math (requires backend running per repo e2e setup)

**Manual checks (if no CLI):**
- `npm run dev`: drag each panel divider and collapse both panels — pitch stays 2:1, centered, no stretch; resize browser window — same.

## Suggested Review Order

**Pitch geometry — the single source of truth**

- Contain-fit letterbox math: fixed 2:1, centered, clamp-to-0 on degenerate canvases
  [`fieldGeometry.ts:17`](../../src/components/canvas/engine/fieldGeometry.ts#L17)

- Zero-rect guard so `screenToPercent` never emits NaN/Infinity
  [`fieldGeometry.ts:43`](../../src/components/canvas/engine/fieldGeometry.ts#L43)

- Player radius = max(8, pitch.height/27) — 1.5× smaller than the legacy 20px
  [`fieldGeometry.ts:61`](../../src/components/canvas/engine/fieldGeometry.ts#L61)

**Pitch rendering**

- Draw derives everything from `computePitchRect`; grass fills the full canvas
  [`Field.ts:34`](../../src/components/canvas/engine/Field.ts#L34)

- Degenerate early return: grass only, no ghost markings
  [`Field.ts:40`](../../src/components/canvas/engine/Field.ts#L40)

- Class converters now delegate to the module — no local math left
  [`Field.ts:101`](../../src/components/canvas/engine/Field.ts#L101)

**Player sprite scaling**

- Radius computed from the pitch rect at construction
  [`Player.ts:44`](../../src/components/canvas/engine/Player.ts#L44)

- Resize refreshes radius, label size, redraw and position (hover preserved)
  [`Player.ts:156`](../../src/components/canvas/engine/Player.ts#L156)

- Hit detection uses the scaled radius
  [`Player.ts:166`](../../src/components/canvas/engine/Player.ts#L166)

**E2E drop-target math**

- Same geometry module replaces the old hardcoded padding-40 formula
  [`tactic-tabs.spec.ts:13`](../../tests/e2e/tactic-tabs.spec.ts#L13)

**Unit tests**

- Geometry matrix: defaults, tie boundary (840×460), odd size (801×600)
  [`field.test.ts:21`](../../tests/unit/field.test.ts#L21)

- Degenerate + multi-rect roundtrip coverage
  [`field.test.ts:273`](../../tests/unit/field.test.ts#L273)

- Radius scaling: ≈13.33px default, 8px floor, proportional growth
  [`field.test.ts:352`](../../tests/unit/field.test.ts#L352)
