/**
 * TacticBridge - Converts between the two tactic data universes.
 * OWNER: Dev Team
 *
 * - TacticConfig: API/store shape (camelCase, y in half-field units 0-50)
 * - TacticData:   PixiJS engine shape (full-field percent units 0-100)
 *
 * The engine renders the whole field height, while the API stores the
 * y coordinate in 0-50 bounds, so the y axis is scaled by a factor of 2
 * in both directions.
 */

import type { TacticConfig, TacticData, Player, TacticPlayerConfig, TeamId } from '@/types';

/** API y (0-50) -> engine y (0-100) multiplier */
const API_Y_SCALE = 2;

/** Display labels per slot (pure UI sugar, never used in logic) */
const SLOT_LABELS = ['GK', 'DEF 1', 'DEF 2', 'ATK 1', 'ATK 2'];

/** Stable engine player id for a slot: home-{slot - 1} */
const playerIdForSlot = (slot: number): string => `home-${slot - 1}`;

/** Engine player id (home-N) -> player slot (N + 1) */
const slotForPlayerId = (playerId: string): number => {
  const parts = playerId.split('-');
  const parsed = Number(parts[parts.length - 1]);
  return Number.isNaN(parsed) ? -1 : parsed + 1;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Home players hold the left half: mirror right-half x across the halfway line, then clamp to [0, 50] */
const normalizeHomeX = (x: number): number => clamp(x > 50 ? 100 - x : x, 0, 50);

const round = (value: number, decimals = 1): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** TacticConfig (API) -> TacticData (engine), sorted by slot */
export const tacticConfigToTacticData = (config: TacticConfig): TacticData => {
  const players: Player[] = config.players
    .slice()
    .sort((a, b) => a.playerSlot - b.playerSlot)
    .map((slot) => ({
      id: playerIdForSlot(slot.playerSlot),
      name: SLOT_LABELS[slot.playerSlot - 1] ?? `Player ${slot.playerSlot}`,
      teamId: 'home',
      number: slot.playerSlot,
      position: {
        x: normalizeHomeX(slot.positionX),
        y: clamp(slot.positionY * API_Y_SCALE, 0, 100),
      },
      assignedScriptId: slot.scriptId,
    }));

  return {
    id: config.id,
    name: config.name,
    players,
    ball: { x: 50, y: 50 },
    scripts: {},
    // Team customization (story 7.4): the engine recolors sprites + goals
    colorPrimary: config.colorPrimary,
    colorSecondary: config.colorSecondary,
  };
};

/** TacticData (engine) -> TacticPlayerConfig[] (API payload), sorted by slot */
export const tacticDataToPlayerConfigs = (tactic: TacticData): TacticPlayerConfig[] => {
  const slots: TacticPlayerConfig[] = [];

  for (const player of tactic.players) {
    if (player.teamId !== 'home') continue;

    const slot = slotForPlayerId(player.id);
    if (slot < 1 || slot > 5) continue;

    slots.push({
      playerSlot: slot as TacticPlayerConfig['playerSlot'],
      positionX: normalizeHomeX(round(player.position.x)),
      positionY: clamp(round(player.position.y / API_Y_SCALE), 0, 50),
      scriptId: player.assignedScriptId,
    });
  }

  return slots.sort((a, b) => a.playerSlot - b.playerSlot);
};

/** Watch/debug roster entry: stable player identity for panel display */
export interface RosterEntry {
  id: string;
  name: string;
  number: number;
  teamId: TeamId;
}

/**
 * Watch/debug roster for a saved tactic, sorted by slot. Uses the same
 * engine id convention as tacticConfigToTacticData so live frame states
 * (keyed by engine player id) join directly onto roster entries.
 */
export const rosterFromTactic = (config: TacticConfig | null): RosterEntry[] => {
  if (!config) return [];

  return config.players
    .slice()
    .sort((a, b) => a.playerSlot - b.playerSlot)
    .map((slot) => ({
      id: playerIdForSlot(slot.playerSlot),
      name: SLOT_LABELS[slot.playerSlot - 1] ?? `Player ${slot.playerSlot}`,
      number: slot.playerSlot,
      teamId: 'home' as const,
    }));
};
