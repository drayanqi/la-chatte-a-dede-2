/**
 * Ball Sprite Unit Tests
 *
 * Tests the pure sizing/constant logic of the ball sprite. The visual
 * rendering itself (Pixi Graphics) is covered by E2E tests on the canvas.
 *
 * @see Story 3.7: Ball sprite (AC #2 — the ball is clearly distinguishable)
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import {
  BALL_MIN_RADIUS,
  BALL_TRAIL_LENGTH,
  computeBallRadius,
} from '@/components/canvas/engine/Ball';

describe('Ball Sprite', () => {
  describe('computeBallRadius', () => {
    it('should scale the radius to 0.8% of the pitch width', () => {
      // GIVEN: The default 800x600 canvas pitch width
      const pitchWidth = 720;

      // WHEN: Computing the ball radius
      const radius = computeBallRadius(pitchWidth);

      // THEN: 0.8% of the pitch width
      expect(radius).toBeCloseTo(720 * 0.008, 10);
    });

    it('should scale proportionally on a larger pitch', () => {
      // GIVEN: A larger pitch width
      const pitchWidth = 1680;

      // WHEN: Computing the ball radius
      const radius = computeBallRadius(pitchWidth);

      // THEN: Still 0.8% of that width
      expect(radius).toBeCloseTo(pitchWidth * 0.008, 10);
    });

    it('should never go below the minimum readable radius', () => {
      // GIVEN: A tiny collapsed-panel pitch where 0.8% is unreadable
      const pitchWidth = 200;

      // WHEN: Computing the ball radius
      const radius = computeBallRadius(pitchWidth);

      // THEN: The floor keeps the ball readable
      expect(pitchWidth * 0.008).toBeLessThan(BALL_MIN_RADIUS);
      expect(radius).toBe(BALL_MIN_RADIUS);
    });

    it('should keep a positive radius on a degenerate zero-width pitch', () => {
      // GIVEN: A degenerate pitch (collapsed panels)
      const pitchWidth = 0;

      // WHEN: Computing the ball radius
      const radius = computeBallRadius(pitchWidth);

      // THEN: Still readable, never zero or negative
      expect(radius).toBe(BALL_MIN_RADIUS);
    });
  });

  describe('trail', () => {
    it('should keep the last 8 positions (fading trail)', () => {
      expect(BALL_TRAIL_LENGTH).toBe(8);
    });
  });
});
