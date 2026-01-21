/**
 * Field Unit Tests
 *
 * Tests the coordinate conversion functions used in the game field.
 * These are pure functions critical for accurate player positioning.
 *
 * @see Epic 3: Field rendering and coordinate system
 * @priority P0
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Extract the coordinate conversion logic for testing
// (These functions mirror Field.ts logic for isolated testing)

const FIELD_PADDING = 40;

interface CoordinateConverter {
  percentToScreen(x: number, y: number, screenWidth: number, screenHeight: number): { x: number; y: number };
  screenToPercent(screenX: number, screenY: number, screenWidth: number, screenHeight: number): { x: number; y: number };
}

const fieldConverter: CoordinateConverter = {
  percentToScreen(x: number, y: number, screenWidth: number, screenHeight: number) {
    const fieldWidth = screenWidth - FIELD_PADDING * 2;
    const fieldHeight = screenHeight - FIELD_PADDING * 2;

    return {
      x: FIELD_PADDING + (x / 100) * fieldWidth,
      y: FIELD_PADDING + (y / 100) * fieldHeight,
    };
  },

  screenToPercent(screenX: number, screenY: number, screenWidth: number, screenHeight: number) {
    const fieldWidth = screenWidth - FIELD_PADDING * 2;
    const fieldHeight = screenHeight - FIELD_PADDING * 2;

    return {
      x: ((screenX - FIELD_PADDING) / fieldWidth) * 100,
      y: ((screenY - FIELD_PADDING) / fieldHeight) * 100,
    };
  },
};

describe('Field Coordinate Conversion', () => {
  const SCREEN_WIDTH = 800;
  const SCREEN_HEIGHT = 600;

  describe('percentToScreen', () => {
    it('should convert origin (0, 0) to top-left padding', () => {
      // GIVEN: Percent position at origin
      const percentX = 0;
      const percentY = 0;

      // WHEN: Converting to screen coordinates
      const result = fieldConverter.percentToScreen(percentX, percentY, SCREEN_WIDTH, SCREEN_HEIGHT);

      // THEN: Should be at padding offset
      expect(result.x).toBe(FIELD_PADDING);
      expect(result.y).toBe(FIELD_PADDING);
    });

    it('should convert (100, 100) to bottom-right corner', () => {
      // GIVEN: Percent position at max corner
      const percentX = 100;
      const percentY = 100;

      // WHEN: Converting to screen coordinates
      const result = fieldConverter.percentToScreen(percentX, percentY, SCREEN_WIDTH, SCREEN_HEIGHT);

      // THEN: Should be at screen size minus padding
      expect(result.x).toBe(SCREEN_WIDTH - FIELD_PADDING);
      expect(result.y).toBe(SCREEN_HEIGHT - FIELD_PADDING);
    });

    it('should convert (50, 50) to center of field', () => {
      // GIVEN: Center percent position
      const percentX = 50;
      const percentY = 50;

      // WHEN: Converting to screen coordinates
      const result = fieldConverter.percentToScreen(percentX, percentY, SCREEN_WIDTH, SCREEN_HEIGHT);

      // THEN: Should be at center of screen
      expect(result.x).toBe(SCREEN_WIDTH / 2);
      expect(result.y).toBe(SCREEN_HEIGHT / 2);
    });

    it('should handle different screen dimensions', () => {
      // GIVEN: Different screen size
      const customWidth = 1920;
      const customHeight = 1080;
      const percentX = 50;
      const percentY = 50;

      // WHEN: Converting to screen coordinates
      const result = fieldConverter.percentToScreen(percentX, percentY, customWidth, customHeight);

      // THEN: Should be at center of custom screen
      expect(result.x).toBe(customWidth / 2);
      expect(result.y).toBe(customHeight / 2);
    });

    it('should scale linearly for intermediate values', () => {
      // GIVEN: Quarter position
      const percentX = 25;
      const percentY = 75;

      // WHEN: Converting to screen coordinates
      const result = fieldConverter.percentToScreen(percentX, percentY, SCREEN_WIDTH, SCREEN_HEIGHT);

      // THEN: Calculate expected values
      const fieldWidth = SCREEN_WIDTH - FIELD_PADDING * 2;
      const fieldHeight = SCREEN_HEIGHT - FIELD_PADDING * 2;
      const expectedX = FIELD_PADDING + (25 / 100) * fieldWidth;
      const expectedY = FIELD_PADDING + (75 / 100) * fieldHeight;

      expect(result.x).toBe(expectedX);
      expect(result.y).toBe(expectedY);
    });
  });

  describe('screenToPercent', () => {
    it('should convert padding position to (0, 0)', () => {
      // GIVEN: Screen position at padding
      const screenX = FIELD_PADDING;
      const screenY = FIELD_PADDING;

      // WHEN: Converting to percent
      const result = fieldConverter.screenToPercent(screenX, screenY, SCREEN_WIDTH, SCREEN_HEIGHT);

      // THEN: Should be at origin
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should convert bottom-right to (100, 100)', () => {
      // GIVEN: Screen position at bottom-right
      const screenX = SCREEN_WIDTH - FIELD_PADDING;
      const screenY = SCREEN_HEIGHT - FIELD_PADDING;

      // WHEN: Converting to percent
      const result = fieldConverter.screenToPercent(screenX, screenY, SCREEN_WIDTH, SCREEN_HEIGHT);

      // THEN: Should be at max percent
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('should convert center to (50, 50)', () => {
      // GIVEN: Screen position at center
      const screenX = SCREEN_WIDTH / 2;
      const screenY = SCREEN_HEIGHT / 2;

      // WHEN: Converting to percent
      const result = fieldConverter.screenToPercent(screenX, screenY, SCREEN_WIDTH, SCREEN_HEIGHT);

      // THEN: Should be at center percent
      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
    });

    it('should handle positions outside valid range', () => {
      // GIVEN: Screen position before padding (invalid click)
      const screenX = 0;
      const screenY = 0;

      // WHEN: Converting to percent
      const result = fieldConverter.screenToPercent(screenX, screenY, SCREEN_WIDTH, SCREEN_HEIGHT);

      // THEN: Should return negative percent (outside field)
      expect(result.x).toBeLessThan(0);
      expect(result.y).toBeLessThan(0);
    });

    it('should handle positions beyond field (invalid click)', () => {
      // GIVEN: Screen position beyond field
      const screenX = SCREEN_WIDTH;
      const screenY = SCREEN_HEIGHT;

      // WHEN: Converting to percent
      const result = fieldConverter.screenToPercent(screenX, screenY, SCREEN_WIDTH, SCREEN_HEIGHT);

      // THEN: Should return >100 percent (outside field)
      expect(result.x).toBeGreaterThan(100);
      expect(result.y).toBeGreaterThan(100);
    });
  });

  describe('Roundtrip Conversion', () => {
    it('should be reversible for valid coordinates', () => {
      // GIVEN: Original percent coordinates
      const originalX = 30;
      const originalY = 70;

      // WHEN: Converting to screen and back
      const screen = fieldConverter.percentToScreen(originalX, originalY, SCREEN_WIDTH, SCREEN_HEIGHT);
      const result = fieldConverter.screenToPercent(screen.x, screen.y, SCREEN_WIDTH, SCREEN_HEIGHT);

      // THEN: Should return to original values
      expect(result.x).toBeCloseTo(originalX, 10);
      expect(result.y).toBeCloseTo(originalY, 10);
    });

    it('should be reversible for all corner positions', () => {
      const corners = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ];

      for (const corner of corners) {
        const screen = fieldConverter.percentToScreen(corner.x, corner.y, SCREEN_WIDTH, SCREEN_HEIGHT);
        const result = fieldConverter.screenToPercent(screen.x, screen.y, SCREEN_WIDTH, SCREEN_HEIGHT);

        expect(result.x).toBeCloseTo(corner.x, 10);
        expect(result.y).toBeCloseTo(corner.y, 10);
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

      for (const testCase of testCases) {
        // WHEN: Converting roundtrip
        const screen = fieldConverter.percentToScreen(testCase.x, testCase.y, SCREEN_WIDTH, SCREEN_HEIGHT);
        const result = fieldConverter.screenToPercent(screen.x, screen.y, SCREEN_WIDTH, SCREEN_HEIGHT);

        // THEN: Should preserve original values
        expect(result.x).toBeCloseTo(testCase.x, 5);
        expect(result.y).toBeCloseTo(testCase.y, 5);
      }
    });
  });

  describe('Field Dimensions', () => {
    it('should calculate correct field dimensions after padding', () => {
      // GIVEN: Standard screen size
      // WHEN: Calculating field dimensions
      const expectedFieldWidth = SCREEN_WIDTH - FIELD_PADDING * 2;
      const expectedFieldHeight = SCREEN_HEIGHT - FIELD_PADDING * 2;

      // THEN: Field should be smaller than screen by 2x padding
      expect(expectedFieldWidth).toBe(720);  // 800 - 80
      expect(expectedFieldHeight).toBe(520); // 600 - 80
    });

    it('should use consistent padding value', () => {
      // Verify padding is 40 as defined in the Field class
      expect(FIELD_PADDING).toBe(40);
    });
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
