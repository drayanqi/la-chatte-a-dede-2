/**
 * Team Mapping Unit Tests (story 3.7, Task 4/6)
 *
 * The engine speaks in 'challenger' | 'opponent'; the renderer speaks in
 * 'home' | 'away' (orange left half vs blue right half). The mapping lives
 * in ONE helper — never scattered inline across the renderer.
 *
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import {
  teamIdFromMatchTeam,
  matchPlayerKey,
} from '@/lib/teamMapping';

describe('Team Mapping', () => {
  describe('teamIdFromMatchTeam', () => {
    it('should map challenger to home (orange, left half)', () => {
      expect(teamIdFromMatchTeam('challenger')).toBe('home');
    });

    it('should map opponent to away (blue, right half)', () => {
      expect(teamIdFromMatchTeam('opponent')).toBe('away');
    });
  });

  describe('matchPlayerKey', () => {
    it('should build a stable key per team and slot', () => {
      expect(matchPlayerKey('challenger', 1)).toBe('challenger-1');
      expect(matchPlayerKey('opponent', 5)).toBe('opponent-5');
    });

    it('should produce distinct keys for every match player', () => {
      const keys = new Set<string>();
      for (const team of ['challenger', 'opponent'] as const) {
        for (let slot = 1; slot <= 5; slot++) {
          keys.add(matchPlayerKey(team, slot));
        }
      }
      expect(keys.size).toBe(10);
    });
  });
});
