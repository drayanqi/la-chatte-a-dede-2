/**
 * Team Color Helper Tests (story 7.4)
 *
 * hexToTeamColor is the bridge between the API's #rrggbb strings and the
 * engine's numeric colors. Invalid input must fall back — never NaN, or
 * the canvas would paint undefined colors.
 *
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import {
  hexToTeamColor,
  PLAYER_HOME_HEX,
  PLAYER_AWAY_HEX,
  TEAM_COLOR_SWATCHES,
  CREST_CHOICES,
  AWAY_COLLISION_DISTANCE,
  resolveAwayTeamHex,
  teamHexDistance,
} from '@/lib/teamColors';
import { PLAYER_HOME_COLOR, PLAYER_AWAY_COLOR } from '@/components/canvas/engine/Player';

describe('hexToTeamColor', () => {
  it('should parse a lowercase #rrggbb hex string', () => {
    expect(hexToTeamColor('#31c48d', 0x000000)).toBe(0x31c48d);
  });

  it('should parse an uppercase #rrggbb hex string', () => {
    expect(hexToTeamColor('#31C48D', 0x000000)).toBe(0x31c48d);
  });

  it('should parse the API default hexes onto the engine constants', () => {
    expect(hexToTeamColor(PLAYER_HOME_HEX, 0x123456)).toBe(PLAYER_HOME_COLOR);
    expect(hexToTeamColor(PLAYER_AWAY_HEX, 0x123456)).toBe(PLAYER_AWAY_COLOR);
  });

  it('should fall back on a missing # prefix', () => {
    expect(hexToTeamColor('31c48d', 0xabcdef)).toBe(0xabcdef);
  });

  it('should fall back on a 5-digit or 8-digit hex', () => {
    expect(hexToTeamColor('#12345', 0xabcdef)).toBe(0xabcdef);
    expect(hexToTeamColor('#12345678', 0xabcdef)).toBe(0xabcdef);
  });

  it('should fall back on garbage or empty input', () => {
    expect(hexToTeamColor('corail', 0xabcdef)).toBe(0xabcdef);
    expect(hexToTeamColor('', 0xabcdef)).toBe(0xabcdef);
  });

  it('should fall back on null/undefined (missing tactic colors)', () => {
    expect(hexToTeamColor(null, 0xabcdef)).toBe(0xabcdef);
    expect(hexToTeamColor(undefined, 0xabcdef)).toBe(0xabcdef);
  });
});

describe('Équipement choices (story 7.4)', () => {
  it('should offer the six mockup swatches', () => {
    expect(TEAM_COLOR_SWATCHES).toEqual([
      '#e4573f',
      '#4aa8e8',
      '#31c48d',
      '#ffc244',
      '#9b6ce8',
      '#12241b',
    ]);
  });

  it('should offer the ten whitelisted crests, all single emoji', () => {
    expect(CREST_CHOICES).toEqual(['⚽', '🦊', '🐺', '🦁', '🐸', '🚀', '🐙', '🔥', '👑', '🍕']);
    for (const crest of CREST_CHOICES) {
      expect([...crest].length).toBe(1);
    }
  });

  it('should keep the mockup swatches parseable hex', () => {
    for (const hex of TEAM_COLOR_SWATCHES) {
      expect(hexToTeamColor(hex, 0)).not.toBe(0);
    }
  });
});

describe('resolveAwayTeamHex (story 7.6 — 10 players, two readable sides)', () => {
  it('keeps a clearly distinct away color untouched', () => {
    // Orange home vs mint away
    expect(resolveAwayTeamHex('#ff6b1a', '#31c48d')).toBe('#31c48d');
  });

  it('resolves an exact collision (same swatch / two default tactics) to the away default', () => {
    // The API default is #ff6b1a for every tactic: two un-customized teams
    // collide — the away side must fall back to the blue default
    expect(resolveAwayTeamHex(PLAYER_HOME_HEX, PLAYER_HOME_HEX)).toBe(PLAYER_AWAY_HEX);
  });

  it('resolves a same-swatch ranked collision to a distinct default', () => {
    // Both players picked the green swatch → away becomes blue
    expect(resolveAwayTeamHex('#31c48d', '#31c48d')).toBe(PLAYER_AWAY_HEX);
  });

  it('steps to the home default when even the away default collides', () => {
    // Home IS the away default blue: the fallback ladder ends on orange
    expect(resolveAwayTeamHex(PLAYER_AWAY_HEX, PLAYER_AWAY_HEX)).toBe(PLAYER_HOME_HEX);
    // Home = the blue-ish swatch: too close to the away default → orange
    expect(resolveAwayTeamHex('#4aa8e8', PLAYER_AWAY_HEX)).toBe(PLAYER_HOME_HEX);
  });

  it('treats near-identical reds as a collision (e4573f vs ff6b1a)', () => {
    const distance = teamHexDistance('#e4573f', '#ff6b1a');
    expect(distance).toBeLessThan(AWAY_COLLISION_DISTANCE);
    expect(resolveAwayTeamHex('#e4573f', '#ff6b1a')).toBe(PLAYER_AWAY_HEX);
  });

  it('measures distance symmetrically and from the hex channels', () => {
    expect(teamHexDistance('#000000', '#000000')).toBe(0);
    expect(teamHexDistance('#ff0000', '#000000')).toBe(255);
    expect(teamHexDistance('#ff0000', '#0000ff')).toBeCloseTo(Math.sqrt(255 ** 2 + 255 ** 2));
    expect(teamHexDistance('#ff0000', '#0000ff')).toBe(
      teamHexDistance('#0000ff', '#ff0000')
    );
  });
});
