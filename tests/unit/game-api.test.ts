/**
 * Game API Unit Tests
 *
 * Tests the game API functions that players use in their AI scripts.
 * These must be deterministic and well-documented.
 *
 * Note: These tests mock the game engine. Full determinism tests
 * will run against the actual Node.js engine in integration tests.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock game context (will be replaced with actual implementation)
interface Position {
  x: number;
  y: number;
}

interface Player {
  slot: number;
  position: Position;
  team: 'challenger' | 'opponent';
}

interface Ball {
  position: Position;
  velocity: Position;
}

interface Goal {
  own: Position;
  enemy: Position;
}

// Game API functions to test
function distanceTo(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isClosestToBall(player: Player, teammates: Player[], ball: Ball): boolean {
  const myDistance = distanceTo(player.position, ball.position);
  return teammates.every(
    (teammate) => distanceTo(teammate.position, ball.position) >= myDistance
  );
}

function normalizeVector(vector: Position): Position {
  const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  if (magnitude === 0) return { x: 0, y: 0 };
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

function moveTowards(current: Position, target: Position, speed: number): Position {
  const direction = {
    x: target.x - current.x,
    y: target.y - current.y,
  };
  const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);

  if (distance <= speed) {
    return target;
  }

  const normalized = normalizeVector(direction);
  return {
    x: current.x + normalized.x * speed,
    y: current.y + normalized.y * speed,
  };
}

describe('Game API', () => {
  describe('distanceTo', () => {
    it('should calculate distance between two points', () => {
      const from = { x: 0, y: 0 };
      const to = { x: 3, y: 4 };
      expect(distanceTo(from, to)).toBe(5);
    });

    it('should return 0 for same point', () => {
      const point = { x: 100, y: 200 };
      expect(distanceTo(point, point)).toBe(0);
    });

    it('should be symmetrical', () => {
      const a = { x: 10, y: 20 };
      const b = { x: 30, y: 40 };
      expect(distanceTo(a, b)).toBe(distanceTo(b, a));
    });

    it('should handle negative coordinates', () => {
      const from = { x: -10, y: -10 };
      const to = { x: 10, y: 10 };
      expect(distanceTo(from, to)).toBeCloseTo(28.284, 3);
    });
  });

  describe('isClosestToBall', () => {
    it('should return true when player is closest', () => {
      const player: Player = { slot: 1, position: { x: 100, y: 100 }, team: 'challenger' };
      const teammates: Player[] = [
        { slot: 2, position: { x: 200, y: 200 }, team: 'challenger' },
        { slot: 3, position: { x: 300, y: 300 }, team: 'challenger' },
      ];
      const ball: Ball = { position: { x: 110, y: 110 }, velocity: { x: 0, y: 0 } };

      expect(isClosestToBall(player, teammates, ball)).toBe(true);
    });

    it('should return false when teammate is closer', () => {
      const player: Player = { slot: 1, position: { x: 300, y: 300 }, team: 'challenger' };
      const teammates: Player[] = [
        { slot: 2, position: { x: 100, y: 100 }, team: 'challenger' },
      ];
      const ball: Ball = { position: { x: 110, y: 110 }, velocity: { x: 0, y: 0 } };

      expect(isClosestToBall(player, teammates, ball)).toBe(false);
    });

    it('should return true when tied (player included in comparison)', () => {
      const player: Player = { slot: 1, position: { x: 100, y: 100 }, team: 'challenger' };
      const teammates: Player[] = [
        { slot: 2, position: { x: 100, y: 100 }, team: 'challenger' }, // Same distance
      ];
      const ball: Ball = { position: { x: 200, y: 100 }, velocity: { x: 0, y: 0 } };

      // Tie should return true (>=)
      expect(isClosestToBall(player, teammates, ball)).toBe(true);
    });
  });

  describe('moveTowards', () => {
    it('should move towards target at given speed', () => {
      const current = { x: 0, y: 0 };
      const target = { x: 100, y: 0 };
      const speed = 10;

      const result = moveTowards(current, target, speed);
      expect(result.x).toBe(10);
      expect(result.y).toBe(0);
    });

    it('should reach target if within speed distance', () => {
      const current = { x: 95, y: 0 };
      const target = { x: 100, y: 0 };
      const speed = 10;

      const result = moveTowards(current, target, speed);
      expect(result).toEqual(target);
    });

    it('should move diagonally correctly', () => {
      const current = { x: 0, y: 0 };
      const target = { x: 100, y: 100 };
      const speed = Math.sqrt(2); // Move 1 unit diagonally

      const result = moveTowards(current, target, speed);
      expect(result.x).toBeCloseTo(1, 5);
      expect(result.y).toBeCloseTo(1, 5);
    });

    it('should not move if already at target', () => {
      const position = { x: 100, y: 100 };
      const speed = 10;

      const result = moveTowards(position, position, speed);
      expect(result).toEqual(position);
    });
  });

  describe('normalizeVector', () => {
    it('should normalize a vector to unit length', () => {
      const vector = { x: 3, y: 4 };
      const normalized = normalizeVector(vector);

      expect(normalized.x).toBeCloseTo(0.6, 5);
      expect(normalized.y).toBeCloseTo(0.8, 5);

      // Verify magnitude is 1
      const magnitude = Math.sqrt(normalized.x ** 2 + normalized.y ** 2);
      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('should return zero vector for zero input', () => {
      const zero = { x: 0, y: 0 };
      const normalized = normalizeVector(zero);

      expect(normalized.x).toBe(0);
      expect(normalized.y).toBe(0);
    });
  });
});

describe('Determinism', () => {
  it('should produce identical results with same inputs', () => {
    // This is a critical test for the deterministic physics requirement
    const position1 = { x: 0, y: 0 };
    const target = { x: 100, y: 100 };
    const speed = 5;

    // Run simulation 100 times
    const results: Position[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(moveTowards({ ...position1 }, target, speed));
    }

    // All results should be identical
    const first = results[0];
    for (const result of results) {
      expect(result.x).toBe(first.x);
      expect(result.y).toBe(first.y);
    }
  });
});
