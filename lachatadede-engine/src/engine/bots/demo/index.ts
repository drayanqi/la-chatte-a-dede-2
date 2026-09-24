import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Demo tactics fixtures ("GK + 1-2-1" for tata@tata.com, "GK + 2-2" for
 * toto@toto.com).
 *
 * Each formation directory holds one plain .js script per player slot
 * (canonical sources, engine test fixtures). `scripts.json` mirrors their
 * exact content together with the tactic name, owner email, script names and
 * home-side kickoff positions; the demo wiring script (scripts/assign-demo-
 * tactics.php at the repo root) seeds it into an existing database. The
 * DemoBots test suite guards the .js <-> scripts.json sync.
 *
 * Scripts are side-free: they are written in the ego frame (own goal x=0,
 * attack toward x=100, script-ia-api.md v3.0) and stored home-side (defends
 * x=0, attacks toward x=100); the engine's script membrane mirrors the pitch
 * for whichever seat defends the right goal. Engine tests build away payloads
 * via demoOpponentPlayers.
 */

export interface DemoFormationPlayer {
  role: string;
  scriptName: string;
  /** Home-side kickoff position. */
  positionX: number;
  positionY: number;
  code: string;
}

export interface DemoFormation {
  key: 'one-two-one' | 'two-two';
  /** Tactic name in the demo database wiring. */
  tacticName: string;
  /** Owner email in the demo database wiring. */
  ownerEmail: string;
  players: DemoFormationPlayer[];
}

const demoDir = path.dirname(fileURLToPath(import.meta.url));

function readScript(formation: string, role: string): string {
  return readFileSync(path.join(demoDir, formation, `${role}.js`), 'utf8');
}

const ONE_TWO_ONE_ROLES = ['goalkeeper', 'fixo', 'ala-top', 'ala-bottom', 'pivot'] as const;
const TWO_TWO_ROLES = ['goalkeeper', 'defender-top', 'defender-bottom', 'forward-top', 'forward-bottom'] as const;

const ONE_TWO_ONE_SCRIPT_NAMES = ['1-2-1 GK', '1-2-1 Fixo', '1-2-1 Ala Top', '1-2-1 Ala Bottom', '1-2-1 Pivot'];
const TWO_TWO_SCRIPT_NAMES = ['2-2 GK', '2-2 Def Top', '2-2 Def Bottom', '2-2 Fwd Top', '2-2 Fwd Bottom'];

const ONE_TWO_ONE_HOME_POSITIONS: [number, number][] = [
  [8, 25], // goalkeeper
  [22, 25], // fixo
  [42, 12], // ala-top
  [42, 38], // ala-bottom
  [62, 25], // pivot
];

const TWO_TWO_HOME_POSITIONS: [number, number][] = [
  [8, 25], // goalkeeper
  [25, 15], // defender-top
  [25, 35], // defender-bottom
  [50, 15], // forward-top
  [50, 35], // forward-bottom
];

function formation(
  key: DemoFormation['key'],
  tacticName: string,
  ownerEmail: string,
  roles: readonly string[],
  scriptNames: string[],
  positions: [number, number][],
): DemoFormation {
  return {
    key,
    tacticName,
    ownerEmail,
    players: roles.map((role, index) => ({
      role,
      scriptName: scriptNames[index] as string,
      positionX: positions[index]![0],
      positionY: positions[index]![1],
      code: readScript(key, role),
    })),
  };
}

/** The two demo tactics, in tata/toto order. */
export const DEMO_FORMATIONS: DemoFormation[] = [
  formation('one-two-one', 'GK + 1-2-1', 'tata@tata.com', ONE_TWO_ONE_ROLES, ONE_TWO_ONE_SCRIPT_NAMES, ONE_TWO_ONE_HOME_POSITIONS),
  formation('two-two', 'GK + 2-2', 'toto@toto.com', TWO_TWO_ROLES, TWO_TWO_SCRIPT_NAMES, TWO_TWO_HOME_POSITIONS),
];

export function demoFormation(key: DemoFormation['key']): DemoFormation {
  const found = DEMO_FORMATIONS.find((f) => f.key === key);
  if (found === undefined) {
    throw new Error(`unknown demo formation ${key}`);
  }
  return found;
}

/** Home-side lineup ready to plug into a SimulatePayload as the challenger. */
export function demoChallengerPlayers(key: DemoFormation['key']): { slot: number; x: number; y: number; script: string }[] {
  return demoFormation(key).players.map((player, index) => ({
    slot: index + 1,
    x: player.positionX,
    y: player.positionY,
    script: player.code,
  }));
}

/** Away-side lineup (mirrored across the halfway line) for the opponent team. */
export function demoOpponentPlayers(key: DemoFormation['key']): { slot: number; x: number; y: number; script: string }[] {
  return demoFormation(key).players.map((player, index) => ({
    slot: index + 1,
    x: 100 - player.positionX,
    y: player.positionY,
    script: player.code,
  }));
}
