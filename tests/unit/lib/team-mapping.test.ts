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
  matchPlayerFromKey,
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

  describe('matchPlayerFromKey (story 3.11)', () => {
    it('should parse the canonical composite back into team and slot', () => {
      // GIVEN: Keys built by matchPlayerKey — the only id convention used
      // by the canvas store for match players
      // WHEN/THEN: The reverse mapping returns the exact parts
      expect(matchPlayerFromKey(matchPlayerKey('challenger', 3))).toEqual({
        team: 'challenger',
        slot: 3,
      });
      expect(matchPlayerFromKey(matchPlayerKey('opponent', 5))).toEqual({
        team: 'opponent',
        slot: 5,
      });
    });

    it('should reject tactic player ids (home-N convention is not a match key)', () => {
      // GIVEN: The tactic roster ids ('home-0'..'home-4') share the dash
      // shape but never belong to the match vocabulary
      // WHEN/THEN: They do not parse as match player keys
      expect(matchPlayerFromKey('home-2')).toBeNull();
      expect(matchPlayerFromKey('away-1')).toBeNull();
    });

    it('should reject malformed or non-player keys', () => {
      // GIVEN: Garbage strings, unknown teams, the SYS sentinel slot 0,
      // non-integer slots and Number()-coercible non-canonical slots
      // WHEN/THEN: None parse into a playable identity
      expect(matchPlayerFromKey('')).toBeNull();
      expect(matchPlayerFromKey('challenger')).toBeNull();
      expect(matchPlayerFromKey('midfielder-2')).toBeNull();
      expect(matchPlayerFromKey('challenger-x')).toBeNull();
      expect(matchPlayerFromKey('challenger-0')).toBeNull();
      expect(matchPlayerFromKey('challenger-2.5')).toBeNull();
      expect(matchPlayerFromKey('challenger-2.0')).toBeNull();
      expect(matchPlayerFromKey('challenger-0x3')).toBeNull();
      expect(matchPlayerFromKey('challenger-1e1')).toBeNull();
      expect(matchPlayerFromKey('challenger-+3')).toBeNull();
      expect(matchPlayerFromKey('challenger- 3')).toBeNull();
      expect(matchPlayerFromKey('challenger-3 ')).toBeNull();
      expect(matchPlayerFromKey('challenger-007')).toBeNull();
    });
  });
});
