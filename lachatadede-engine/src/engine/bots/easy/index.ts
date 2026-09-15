import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Easy Bot fixtures (story 3.6).
 *
 * The five plain .js files in this directory are the canonical bot scripts
 * (engine test fixtures). `scripts.json` mirrors their exact content as the
 * transferable artifact copied into the Laravel API
 * (database/seeders/data/easy-bot-scripts.json) where SystemTacticService
 * seeds them as script rows owned by the system user. The EasyBot test suite
 * guards the .js <-> scripts.json sync.
 *
 * Bots are team-generic: the engine maps challenger->'home' and
 * opponent->'away', and the user always plays the challenger side, so in
 * production the bots run as 'away' (own goal x=100, attack toward x=0).
 */
export interface EasyBotScripts {
  goalkeeper: string;
  defender1: string;
  defender2: string;
  attacker1: string;
  attacker2: string;
}

const botDir = path.dirname(fileURLToPath(import.meta.url));

function readScript(role: string): string {
  return readFileSync(path.join(botDir, `${role}.js`), 'utf8');
}

/** Canonical Easy Bot scripts, one per tactic slot in formation order. */
export const EASY_BOT_SCRIPTS: EasyBotScripts = {
  goalkeeper: readScript('goalkeeper'),
  defender1: readScript('defender1'),
  defender2: readScript('defender2'),
  attacker1: readScript('attacker1'),
  attacker2: readScript('attacker2'),
};

/** Slot 1..5 -> script code (1 GK, 2-3 DEF, 4-5 ATK). */
export const EASY_BOT_SCRIPTS_BY_SLOT: string[] = [
  EASY_BOT_SCRIPTS.goalkeeper,
  EASY_BOT_SCRIPTS.defender1,
  EASY_BOT_SCRIPTS.defender2,
  EASY_BOT_SCRIPTS.attacker1,
  EASY_BOT_SCRIPTS.attacker2,
];

/**
 * Away-side kickoff geometry: the 3.2 home formation (GK 8/25, DEF 25/15 and
 * 25/35, ATK 40/15 and 40/35) mirrored across the halfway line. In production
 * the tactic is stored home-side and GameEngineService mirrors it; engine
 * tests build opponent payloads directly, so they need the mirrored values.
 */
const EASY_BOT_AWAY_POSITIONS: [number, number][] = [
  [92, 25],
  [75, 15],
  [75, 35],
  [60, 15],
  [60, 35],
];

/** Bot lineup ready to plug into a SimulatePayload as the opponent team. */
export const EASY_BOT_OPPONENT_PLAYERS: { slot: number; x: number; y: number; script: string }[] =
  EASY_BOT_SCRIPTS_BY_SLOT.map((script, index) => {
    const [x, y] = EASY_BOT_AWAY_POSITIONS[index] as [number, number];
    return { slot: index + 1, x, y, script };
  });
