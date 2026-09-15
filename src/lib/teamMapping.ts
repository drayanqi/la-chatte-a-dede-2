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
