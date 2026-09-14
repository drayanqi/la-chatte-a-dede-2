import type { FrameLog, SlotAction, Team } from './types.js';

export interface PlayerScript {
  slot: number;
  team: Team;
  code: string;
}

export interface ScriptTickContext {
  tick: number;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    owner: { slot: number; team: Team } | null;
  };
  players: {
    slot: number;
    team: Team;
    x: number;
    y: number;
  }[];
}

export interface TickOutcome {
  actions: SlotAction[];
  logs: FrameLog[];
}

/**
 * Executes player scripts. Story 3.3 ships only the interface plus the Noop
 * implementation; Story 3.4 delivers the isolated-vm implementation.
 */
export interface ScriptRunner {
  prepare(scripts: PlayerScript[]): void | Promise<void>;
  runTick(tick: number, context: ScriptTickContext): TickOutcome;
}

/**
 * Placeholder runner: no actions, no logs. Keeps Story 3.3 fully testable
 * while the sandboxed execution (Story 3.4) is not available yet.
 */
export class NoopScriptRunner implements ScriptRunner {
  prepare(): void {}

  runTick(): TickOutcome {
    return { actions: [], logs: [] };
  }
}
