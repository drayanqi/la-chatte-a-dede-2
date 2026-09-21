/**
 * Field Unit Tests
 *
 * Tests the pure field geometry module (fixed 2:1 futsal pitch letterboxing)
 * used by the engine for drawing and coordinate conversion.
 * These are pure functions critical for accurate player positioning.
 *
 * @see Epic 3: Field rendering and coordinate system
 * @priority P0
 */
import { describe, it, expect } from 'vitest';
import {
  FIELD_PADDING,
  PITCH_ASPECT_RATIO,
  computePitchRect,
  computePlayerRadius,
  percentToScreen,
  screenToPercent,
} from '@/components/canvas/engine/fieldGeometry';
import { FIELD_PALETTE, Field } from '@/components/canvas/engine/Field';

describe('Field Geometry', () => {
  describe('computePitchRect', () => {
    it('should letterbox an 800x600 canvas to a 720x360 pitch at (40, 120)', () => {
      // GIVEN: Default canvas size
      const canvasWidth = 800;
      const canvasHeight = 600;

      // WHEN: Computing the pitch rect
      const rect = computePitchRect(canvasWidth, canvasHeight);

      // THEN: Width-limited contain-fit, vertically centered
      expect(rect).toEqual({ x: 40, y: 120, width: 720, height: 360 });
      expect(rect.width / rect.height).toBe(PITCH_ASPECT_RATIO);
    });

    it('should height-limit a 1600x500 canvas to an 840x420 pitch at (380, 40)', () => {
      // GIVEN: Wide, short canvas
      const canvasWidth = 1600;
      const canvasHeight = 500;

      // WHEN: Computing the pitch rect
      const rect = computePitchRect(canvasWidth, canvasHeight);

      // THEN: Height-limited contain-fit, horizontally centered
      expect(rect).toEqual({ x: 380, y: 40, width: 840, height: 420 });
      expect(rect.width / rect.height).toBe(PITCH_ASPECT_RATIO);
    });

    it('should keep an exact 2:1 aspect ratio across several canvas sizes', () => {
      // GIVEN: Several canvas sizes (wide, tall, standard)
      const canvasSizes = [
        { width: 800, height: 600 },
        { width: 1600, height: 500 },
        { width: 1024, height: 768 },
        { width: 500, height: 1000 },
        { width: 1920, height: 1080 },
      ];

      for (const size of canvasSizes) {
        // WHEN: Computing the pitch rect
        const rect = computePitchRect(size.width, size.height);

        // THEN: Ratio must be exactly 2:1
        expect(rect.width / rect.height).toBe(PITCH_ASPECT_RATIO);
      }
    });

    it('should keep at least a 40px margin on every side', () => {
      // GIVEN: Several canvas sizes
      const canvasSizes = [
        { width: 800, height: 600 },
        { width: 1600, height: 500 },
        { width: 1024, height: 768 },
      ];

      for (const size of canvasSizes) {
        // WHEN: Computing the pitch rect
        const rect = computePitchRect(size.width, size.height);

        // THEN: Pitch stays inside canvas minus padding on all sides
        expect(rect.x).toBeGreaterThanOrEqual(FIELD_PADDING);
        expect(rect.y).toBeGreaterThanOrEqual(FIELD_PADDING);
        expect(rect.x + rect.width).toBeLessThanOrEqual(size.width - FIELD_PADDING);
        expect(rect.y + rect.height).toBeLessThanOrEqual(size.height - FIELD_PADDING);
      }
    });

    it('should clamp dimensions to 0 on a degenerate 80x80 canvas without throwing', () => {
      // GIVEN: Canvas with zero available space after padding
      const canvasWidth = 80;
      const canvasHeight = 80;

      // WHEN: Computing the pitch rect
      const rect = computePitchRect(canvasWidth, canvasHeight);

      // THEN: Dimensions clamp to 0, no negatives, no crash
      expect(rect.width).toBe(0);
      expect(rect.height).toBe(0);
      expect(rect.width).toBeGreaterThanOrEqual(0);
      expect(rect.height).toBeGreaterThanOrEqual(0);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
    });

    it('should clamp dimensions to 0 on a canvas smaller than the margin (50x50)', () => {
      // GIVEN: Canvas smaller than the padding on both axes
      const canvasWidth = 50;
      const canvasHeight = 50;

      // WHEN: Computing the pitch rect
      const rect = computePitchRect(canvasWidth, canvasHeight);

      // THEN: Dimensions clamp to 0, no negatives, no crash
      expect(rect.width).toBe(0);
      expect(rect.height).toBe(0);
      expect(rect.width).toBeGreaterThanOrEqual(0);
      expect(rect.height).toBeGreaterThanOrEqual(0);
    });

    it('should use consistent padding and ratio constants', () => {
      // Verify the exported constants match the engine expectations
      expect(FIELD_PADDING).toBe(40);
      expect(PITCH_ASPECT_RATIO).toBe(2);
    });

    it('should keep a 760x380 pitch at (40, 40) when both limits bind exactly (840x460)', () => {
      // GIVEN: Canvas whose available area is exactly 2:1 (tie boundary)
      const rect = computePitchRect(840, 460);

      // THEN: Width-limit and height-limit agree on the same rect
      expect(rect).toEqual({ x: 40, y: 40, width: 760, height: 380 });
      expect(rect.width / rect.height).toBe(PITCH_ASPECT_RATIO);
    });

    it('should handle odd canvas sizes with fractional rects and exact ratio (801x600)', () => {
      // GIVEN: Canvas with non-dividing dimensions
      const rect = computePitchRect(801, 600);

      // THEN: Fractional rect, exact ratio, margins respected
      expect(rect).toEqual({ x: 40, y: 119.75, width: 721, height: 360.5 });
      expect(rect.width / rect.height).toBe(PITCH_ASPECT_RATIO);
      expect(rect.x).toBeGreaterThanOrEqual(FIELD_PADDING);
      expect(rect.y).toBeGreaterThanOrEqual(FIELD_PADDING);
      expect(rect.x + rect.width).toBeLessThanOrEqual(801 - FIELD_PADDING);
      expect(rect.y + rect.height).toBeLessThanOrEqual(600 - FIELD_PADDING);
    });
  });

  describe('percentToScreen', () => {
    it('should convert origin (0, 0) to the pitch rect top-left', () => {
      // GIVEN: Percent position at origin and a computed pitch rect
      const rect = computePitchRect(800, 600);

      // WHEN: Converting to screen coordinates
      const result = percentToScreen(rect, 0, 0);

      // THEN: Should be at the pitch rect top-left corner
      expect(result.x).toBe(rect.x);
      expect(result.y).toBe(rect.y);
    });

    it('should convert (100, 100) to the pitch rect bottom-right corner', () => {
      // GIVEN: Percent position at max corner and a computed pitch rect
      const rect = computePitchRect(800, 600);

      // WHEN: Converting to screen coordinates
      const result = percentToScreen(rect, 100, 100);

      // THEN: Should be at the pitch rect bottom-right corner
      expect(result.x).toBe(rect.x + rect.width);
      expect(result.y).toBe(rect.y + rect.height);
    });

    it('should convert (50, 50) to the canvas center on multiple sizes', () => {
      // GIVEN: Several canvas sizes (the pitch is always centered)
      const canvasSizes = [
        { width: 800, height: 600 },
        { width: 1600, height: 500 },
        { width: 1920, height: 1080 },
      ];

      for (const size of canvasSizes) {
        const rect = computePitchRect(size.width, size.height);

        // WHEN: Converting the center percent position
        const result = percentToScreen(rect, 50, 50);

        // THEN: Should be at the center of the canvas
        expect(result.x).toBe(size.width / 2);
        expect(result.y).toBe(size.height / 2);
      }
    });

    it('should scale linearly for intermediate values', () => {
      // GIVEN: Quarter position on the default canvas
      const rect = computePitchRect(800, 600);

      // WHEN: Converting to screen coordinates
      const result = percentToScreen(rect, 25, 75);

      // THEN: Calculate expected values relative to the pitch rect
      const expectedX = rect.x + (25 / 100) * rect.width;
      const expectedY = rect.y + (75 / 100) * rect.height;

      expect(result.x).toBe(expectedX);
      expect(result.y).toBe(expectedY);
    });
  });

  describe('screenToPercent', () => {
    it('should convert pitch top-left to (0, 0)', () => {
      // GIVEN: Screen position at the pitch rect top-left
      const rect = computePitchRect(800, 600);

      // WHEN: Converting to percent
      const result = screenToPercent(rect, rect.x, rect.y);

      // THEN: Should be at origin
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should convert pitch bottom-right to (100, 100)', () => {
      // GIVEN: Screen position at the pitch rect bottom-right
      const rect = computePitchRect(800, 600);

      // WHEN: Converting to percent
      const result = screenToPercent(rect, rect.x + rect.width, rect.y + rect.height);

      // THEN: Should be at max percent
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('should convert canvas center to (50, 50)', () => {
      // GIVEN: Screen position at canvas center
      const rect = computePitchRect(800, 600);
      const screenX = 400;
      const screenY = 300;

      // WHEN: Converting to percent
      const result = screenToPercent(rect, screenX, screenY);

      // THEN: Should be at center percent
      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
    });

    it('should return negative percents for positions outside the pitch (unclamped)', () => {
      // GIVEN: Screen position at the canvas top-left corner (outside pitch)
      const rect = computePitchRect(800, 600);

      // WHEN: Converting to percent
      const result = screenToPercent(rect, 0, 0);

      // THEN: Should return negative percent (outside field)
      expect(result.x).toBeLessThan(0);
      expect(result.y).toBeLessThan(0);
    });

    it('should return percents above 100 for positions beyond the pitch (unclamped)', () => {
      // GIVEN: Screen position at the canvas bottom-right corner (outside pitch)
      const rect = computePitchRect(800, 600);

      // WHEN: Converting to percent
      const result = screenToPercent(rect, 800, 600);

      // THEN: Should return >100 percent (outside field)
      expect(result.x).toBeGreaterThan(100);
      expect(result.y).toBeGreaterThan(100);
    });

    it('should return finite values on a zero-size (degenerate) pitch rect', () => {
      // GIVEN: A degenerate canvas whose pitch rect has zero dimensions
      const rect = computePitchRect(80, 80);

      // WHEN: Converting any screen position to percent
      const result = screenToPercent(rect, 40, 40);

      // THEN: No NaN or Infinity ever escapes
      expect(Number.isFinite(result.x)).toBe(true);
      expect(Number.isFinite(result.y)).toBe(true);
      expect(result).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Roundtrip Conversion', () => {
    const rects = [
      { label: 'default 800x600', rect: computePitchRect(800, 600) },
      { label: 'fractional 801x600', rect: computePitchRect(801, 600) },
      { label: 'wide 1600x500', rect: computePitchRect(1600, 500) },
    ];

    it('should be reversible for valid coordinates', () => {
      // GIVEN: Original percent coordinates
      const originalX = 30;
      const originalY = 70;

      for (const { rect } of rects) {
        // WHEN: Converting to screen and back
        const screen = percentToScreen(rect, originalX, originalY);
        const result = screenToPercent(rect, screen.x, screen.y);

        // THEN: Should return to original values
        expect(result.x).toBeCloseTo(originalX, 10);
        expect(result.y).toBeCloseTo(originalY, 10);
      }
    });

    it('should be reversible for all corner positions', () => {
      const corners = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ];

      for (const { rect } of rects) {
        for (const corner of corners) {
          const screen = percentToScreen(rect, corner.x, corner.y);
          const result = screenToPercent(rect, screen.x, screen.y);

          expect(result.x).toBeCloseTo(corner.x, 10);
          expect(result.y).toBeCloseTo(corner.y, 10);
        }
      }
    });

    it('should be reversible for random coordinates', () => {
      // GIVEN: Multiple random valid coordinates
      const testCases = [
        { x: 12.5, y: 87.3 },
        { x: 50.0, y: 50.0 },
        { x: 99.9, y: 0.1 },
        { x: 33.33, y: 66.67 },
      ];

      for (const { rect } of rects) {
        for (const testCase of testCases) {
          // WHEN: Converting roundtrip
          const screen = percentToScreen(rect, testCase.x, testCase.y);
          const result = screenToPercent(rect, screen.x, screen.y);

          // THEN: Should preserve original values
          expect(result.x).toBeCloseTo(testCase.x, 5);
          expect(result.y).toBeCloseTo(testCase.y, 5);
        }
      }
    });
  });

  describe('computePlayerRadius', () => {
    it('should derive the radius from pitch height at the default 800x600 canvas (1.5x smaller than legacy 20px)', () => {
      // GIVEN: The default canvas size
      const pitch = computePitchRect(800, 600);

      // WHEN: Computing the player radius
      const radius = computePlayerRadius(pitch);

      // THEN: pitch.height / 27 — 1.5x smaller than the previous fixed RADIUS = 20
      expect(radius).toBeCloseTo(360 / 27, 10);
      expect(radius).toBeLessThan(14);
    });

    it('should scale proportionally with the pitch height', () => {
      // GIVEN: A larger canvas
      const pitch = computePitchRect(1920, 1080);

      // WHEN: Computing the player radius
      const radius = computePlayerRadius(pitch);

      // THEN: Radius is pitch.height / 27 with no upper cap
      expect(radius).toBeCloseTo(pitch.height / 27, 10);
      expect(radius).toBeGreaterThan(13.34);
    });

    it('should floor the radius at 8px on tiny canvases', () => {
      // GIVEN: A collapsed-panel canvas producing a small pitch
      const pitch = computePitchRect(200, 150);

      // WHEN: Computing the player radius
      const radius = computePlayerRadius(pitch);

      // THEN: The 8px floor keeps the sprite visible and clickable
      expect(pitch.height / 27).toBeLessThan(8);
      expect(radius).toBe(8);
    });
  });
});

describe('Field Palette (story 3.7, Task 3/6)', () => {
  it('should use the locked Epic 5.1 pitch palette from the UX spec', () => {
    // THEN: pitch-base #1a2634, lines #ffffff, letterbox #111a24
    expect(FIELD_PALETTE.pitchBase).toBe(0x1a2634);
    expect(FIELD_PALETTE.lines).toBe(0xffffff);
    expect(FIELD_PALETTE.letterbox).toBe(0x111a24);
  });

  it('should reserve team colors for accents, never as the floor paint', () => {
    // Hard law (ux-design-specification.md): team/player colors never paint
    // the floor beneath players — they only appear as goal frames and
    // player/goal accents (the half-wash floor gradients are gone in 7.3).
    expect(FIELD_PALETTE.homeHalf).toBe(0xff6b1a);
    expect(FIELD_PALETTE.awayHalf).toBe(0x1a8cff);
    expect(FIELD_PALETTE.goalHome).toBe(0xff6b1a);
    expect(FIELD_PALETTE.goalAway).toBe(0x1a8cff);
  });
});

describe('Field Palette — La Ronde habillage (story 7.3, Task 1/6)', () => {
  it('should carry the v4 mockup stripe and wall palette entries', () => {
    // THEN: mockup v4 values — stripes #3fae62/#379c56, walls rgba(10,20,14)/white
    expect(FIELD_PALETTE.pitchStripeLight).toBe(0x3fae62);
    expect(FIELD_PALETTE.pitchStripeDark).toBe(0x379c56);
    expect(FIELD_PALETTE.wallBand).toBe(0x0a140e);
    expect(FIELD_PALETTE.wallLine).toBe(0xffffff);
  });

  it('should keep the stripes theme-stable greens distinct from team colors', () => {
    // AC #2: the floor stays neutral vs the players (Epic 5.1 law)
    expect(FIELD_PALETTE.pitchStripeLight).not.toBe(FIELD_PALETTE.homeHalf);
    expect(FIELD_PALETTE.pitchStripeDark).not.toBe(FIELD_PALETTE.awayHalf);
    expect(FIELD_PALETTE.pitchStripeLight).not.toBe(FIELD_PALETTE.pitchStripeDark);
  });

  it('should stripe the pitch with 78px bands clipped to the rounded rect', () => {
    // Mockup .pitch: repeating-linear-gradient(90deg, pitch 0 78px, dark 78px 156px)
    // — the band width is a mockup constant, light band first at the left edge
    const band = 78;
    const pitch = { x: 40, y: 120, width: 720, height: 360 };

    // Light bands start at the pitch left edge and repeat every 2*band px
    const lightBandStarts: number[] = [];
    for (let x = pitch.x; x < pitch.x + pitch.width; x += band * 2) {
      lightBandStarts.push(x);
    }
    expect(lightBandStarts).toEqual([40, 196, 352, 508, 664]);
    // The last light band is clipped to the pitch right edge
    const lastStart = lightBandStarts[lightBandStarts.length - 1];
    expect(Math.min(band, pitch.x + pitch.width - lastStart)).toBe(band);
  });

  it('should size the bare watermark inside 80% of the center circle', () => {
    // Pelo review: no white disc — the mascot image alone, contain-fit in
    // 80% of the center circle (a crest painted on a real pitch)
    const circleRatio = 0.8;

    const watermarkRadius = (pitch: { width: number; height: number }): number =>
      Math.min(pitch.width, pitch.height) * 0.15 * circleRatio;

    // Standard 720x360 pitch: 0.8 * 54 = 43.2px radius (86.4px crest)
    expect(watermarkRadius({ width: 720, height: 360 })).toBeCloseTo(43.2, 6);
    // The crest never exceeds the center circle
    for (const pitch of [
      { width: 720, height: 360 },
      { width: 1600, height: 800 },
      { width: 400, height: 200 },
    ]) {
      expect(watermarkRadius(pitch)).toBeLessThanOrEqual(
        Math.min(pitch.width, pitch.height) * 0.15
      );
    }
  });
});

describe('Field Team Colors (story 7.4)', () => {
  it('should recolor goal frames and accept a full redraw without throwing', () => {
    // GIVEN: A field at the default canvas size (jsdom: no WebGL — the
    // class only builds its Graphics/Text layers)
    const field = new Field(800, 600);

    // WHEN: The team colors change (and then repeat — the no-op guard)
    field.setTeamColors(0x31c48d, 0x4aa8e8);
    field.setTeamColors(0x31c48d, 0x4aa8e8);

    // THEN: No crash; cleanup works
    field.dispose();
  });
});

describe('Player Hit Detection', () => {
  const PLAYER_RADIUS = 20;

  function containsPoint(
    containerX: number,
    containerY: number,
    screenX: number,
    screenY: number
  ): boolean {
    const dx = screenX - containerX;
    const dy = screenY - containerY;
    return Math.sqrt(dx * dx + dy * dy) <= PLAYER_RADIUS;
  }

  it('should detect click on player center', () => {
    // GIVEN: Player at position and click at same position
    const playerX = 100;
    const playerY = 100;
    const clickX = 100;
    const clickY = 100;

    // WHEN: Checking hit
    const result = containsPoint(playerX, playerY, clickX, clickY);

    // THEN: Should be hit
    expect(result).toBe(true);
  });

  it('should detect click within radius', () => {
    // GIVEN: Click 10 pixels away (within 20px radius)
    const playerX = 100;
    const playerY = 100;
    const clickX = 110;
    const clickY = 100;

    // WHEN: Checking hit
    const result = containsPoint(playerX, playerY, clickX, clickY);

    // THEN: Should be hit
    expect(result).toBe(true);
  });

  it('should detect click exactly at radius edge', () => {
    // GIVEN: Click exactly at radius distance (20px)
    const playerX = 100;
    const playerY = 100;
    const clickX = 120;
    const clickY = 100;

    // WHEN: Checking hit
    const result = containsPoint(playerX, playerY, clickX, clickY);

    // THEN: Should be hit (inclusive)
    expect(result).toBe(true);
  });

  it('should NOT detect click outside radius', () => {
    // GIVEN: Click 25 pixels away (outside 20px radius)
    const playerX = 100;
    const playerY = 100;
    const clickX = 125;
    const clickY = 100;

    // WHEN: Checking hit
    const result = containsPoint(playerX, playerY, clickX, clickY);

    // THEN: Should NOT be hit
    expect(result).toBe(false);
  });

  it('should handle diagonal distance correctly', () => {
    // GIVEN: Diagonal click at ~14.14 pixels (within radius)
    const playerX = 100;
    const playerY = 100;
    const clickX = 110;
    const clickY = 110;
    // Distance = sqrt(10^2 + 10^2) = sqrt(200) ≈ 14.14

    // WHEN: Checking hit
    const result = containsPoint(playerX, playerY, clickX, clickY);

    // THEN: Should be hit
    expect(result).toBe(true);
  });

  it('should handle diagonal distance outside radius', () => {
    // GIVEN: Diagonal click at ~21.21 pixels (outside 20px radius)
    const playerX = 100;
    const playerY = 100;
    const clickX = 115;
    const clickY = 115;
    // Distance = sqrt(15^2 + 15^2) = sqrt(450) ≈ 21.21

    // WHEN: Checking hit
    const result = containsPoint(playerX, playerY, clickX, clickY);

    // THEN: Should NOT be hit
    expect(result).toBe(false);
  });
});
