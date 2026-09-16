/**
 * Team Mapping - single translation point between the engine's team
 * vocabulary ('challenger' | 'opponent', as written in match frame files)
 * and the renderer's ('home' | 'away', orange left half vs blue right half).
 *
 * NEVER map teams inline elsewhere in the renderer.
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import type { TeamId, MatchTeam } from '@/types';

/** challenger → home (orange, left half); opponent → away (blue, right half) */
export function teamIdFromMatchTeam(team: MatchTeam): TeamId {
  return team === 'challenger' ? 'home' : 'away';
}

/** Stable sprite id for a match player, keyed by engine team and slot */
export function matchPlayerKey(team: MatchTeam, slot: number): string {
  return `${team}-${slot}`;
}

/** Parts of a match player identity, as composed by matchPlayerKey */
export interface MatchPlayerRef {
  team: MatchTeam;
  slot: number;
}

const MATCH_TEAMS: readonly MatchTeam[] = ['challenger', 'opponent'];

/**
 * Inverse of matchPlayerKey: the canonical composite ('challenger-3') back
 * into its parts. Returns null for anything that is not a real match player
 * key — tactic roster ids ('home-2'), system sentinels (slot 0), garbage.
 * The ONLY place a match key is ever decomposed.
 */
export function matchPlayerFromKey(key: string): MatchPlayerRef | null {
  const separator = key.lastIndexOf('-');
  if (separator <= 0) return null;

  const team = key.slice(0, separator);
  if (!MATCH_TEAMS.includes(team as MatchTeam)) return null;

  const slotPart = key.slice(separator + 1);
  // Canonical keys only: matchPlayerKey emits plain decimal slots, so
  // Number()'s coercions ('0x3', '2.0', '1e1', whitespace, leading zeros)
  // must not slip through the validation gate
  if (!/^\d+$/.test(slotPart)) return null;
  const slot = Number(slotPart);
  if (slot < 1 || String(slot) !== slotPart) return null;

  return { team: team as MatchTeam, slot };
}
