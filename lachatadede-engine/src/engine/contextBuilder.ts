import type { ScriptTickContext } from './ScriptRunner.js';
import type { Team } from './types.js';

/**
 * Host side of the script-ia-api.md v2.0 contract.
 *
 * Each tick, for each player, a plain-data snapshot is built on the host and
 * deep-copied into the player's isolate. The in-isolate shim (SCRIPT_SHIM
 * below) turns that raw data into the `game` object the script sees, attaching
 * action methods to `me` only. The copy is the isolation boundary: scripts can
 * mutate what they receive without affecting the simulation or other players.
 *
 * Engine team names map to script team names:
 *   challenger -> 'home', opponent -> 'away'.
 */

export type ScriptTeam = 'home' | 'away';

export interface ScriptPlayerData {
  slot: number;
  team: ScriptTeam;
  position: { x: number; y: number };
  hasBall: boolean;
  isClosestToBall: boolean;
}

export interface ScriptFieldData {
  width: number;
  height: number;
  goals: {
    home: { x: number; y: number; width: number };
    away: { x: number; y: number; width: number };
  };
  zones: {
    homeBox: { x1: number; y1: number; x2: number; y2: number };
    awayBox: { x1: number; y1: number; x2: number; y2: number };
    center: { x: number; y: number };
  };
}

export interface ScriptBallData {
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  /** `"home-3"` / `"away-1"` style player id, or null when the ball is free. */
  owner: string | null;
}

export interface SharedTickData {
  ball: ScriptBallData;
  players: ScriptPlayerData[];
  field: ScriptFieldData;
}

export interface PlayerTickData {
  me: ScriptPlayerData;
  ball: ScriptBallData;
  players: ScriptPlayerData[];
  field: ScriptFieldData;
}

export function engineTeamToScript(team: Team): ScriptTeam {
  return team === 'challenger' ? 'home' : 'away';
}

export function scriptTeamToEngine(team: ScriptTeam): Team {
  return team === 'home' ? 'challenger' : 'opponent';
}

export function scriptOwnerId(team: Team, slot: number): string {
  return `${engineTeamToScript(team)}-${slot}`;
}

/** Field description per script-ia-api.md (goal width = GOAL_Y_MAX - GOAL_Y_MIN). */
export const FIELD_DATA: ScriptFieldData = {
  width: 100,
  height: 50,
  goals: {
    home: { x: 0, y: 25, width: 20 },
    away: { x: 100, y: 25, width: 20 },
  },
  zones: {
    homeBox: { x1: 0, y1: 15, x2: 16, y2: 35 },
    awayBox: { x1: 84, y1: 15, x2: 100, y2: 35 },
    center: { x: 50, y: 25 },
  },
};

/**
 * Builds the tick-wide view shared by all players: ball with velocity, every
 * player with hasBall and the engine-computed isClosestToBall flag, and the
 * constant field description.
 *
 * isClosestToBall is computed among a player's own team (the player itself
 * included); ties are resolved by the lower slot so the flag is deterministic.
 */
export function buildSharedTickData(context: ScriptTickContext): SharedTickData {
  const owner = context.ball.owner;
  const players: ScriptPlayerData[] = context.players.map((p) => ({
    slot: p.slot,
    team: engineTeamToScript(p.team),
    position: { x: p.x, y: p.y },
    hasBall: owner !== null && owner.slot === p.slot && owner.team === p.team,
    isClosestToBall: false,
  }));
  for (const p of players) {
    // Candidates: same team. The tie-break is by slot, NOT by array position —
    // the /simulate payload validates slot uniqueness but not ordering.
    const candidates = players.filter((c) => c.team === p.team);
    let best = candidates[0] as ScriptPlayerData;
    let bestDistance = distanceSquaredToBall(best, context);
    for (const c of candidates) {
      const d = distanceSquaredToBall(c, context);
      if (d < bestDistance || (d === bestDistance && c.slot < best.slot)) {
        best = c;
        bestDistance = d;
      }
    }
    p.isClosestToBall = best.slot === p.slot;
  }
  return {
    ball: {
      position: { x: context.ball.x, y: context.ball.y },
      velocity: { vx: context.ball.vx, vy: context.ball.vy },
      owner:
        owner === null
          ? null
          : scriptOwnerId(owner.team, owner.slot),
    },
    players,
    field: FIELD_DATA,
  };
}

/** Assembles the per-player tick data (`me` plus the shared view). */
export function buildPlayerTickData(
  shared: SharedTickData,
  team: ScriptTeam,
  slot: number,
): PlayerTickData {
  const me = shared.players.find((p) => p.team === team && p.slot === slot);
  if (me === undefined) {
    throw new Error(`no player data for team ${team} slot ${slot}`);
  }
  return { me, ball: shared.ball, players: shared.players, field: shared.field };
}

function distanceSquaredToBall(p: ScriptPlayerData, context: ScriptTickContext): number {
  const dx = p.position.x - context.ball.x;
  const dy = p.position.y - context.ball.y;
  return dx * dx + dy * dy;
}

/**
 * Executed once at the top of the bundle, BEFORE the user code: gives the
 * script a harmless no-op `console` so top-level console calls do not crash
 * the initialization (their output is dropped - it runs only once, not per
 * tick). Must stay exactly one line: user-code line numbers in syntax errors
 * are corrected by PREAMBLE_LINE_OFFSET.
 */
export const SCRIPT_PREAMBLE =
  'globalThis.console={log:function(){},warn:function(){},error:function(){}};\n';

/** User code starts on this bundle line (the preamble occupies the ones before). */
export const PREAMBLE_LINE_OFFSET = 1;

/**
 * In-isolate shim appended after the user code. Defines globalThis.__run(data)
 * which, per tick:
 *  1. builds the script-ia-api.md `game` object from the raw tick data
 *  2. wraps `me` with action methods that record actions/warnings
 *  3. captures console.log/warn/error per tick
 *  4. calls update(game), catching runtime errors
 *  5. returns a JSON string: { actions, logs, error }
 *
 * Action rules (script-ia-api.md):
 *  - only the FIRST recorded action of a tick applies; later calls get a
 *    MULTIPLE_ACTIONS warning
 *  - dribble/shoot without possession produce DRIBBLE_NO_BALL / SHOOT_NO_BALL
 *    and are ignored (they do not consume the one-action budget)
 *  - moveTo is provided as a compatibility alias of moveToward
 *  - kick/kickBall are deliberately NOT provided
 */
export const SCRIPT_SHIM = `
;(function() {
  "use strict";
  var state = { actions: [], logs: [], actionTaken: false };
  var MAX_LOGS_PER_TICK = 100;
  var MAX_MESSAGE_LENGTH = 500;
  function serialize(v) {
    if (typeof v === "string") return v;
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }
  function truncate(message) {
    return message.length > MAX_MESSAGE_LENGTH
      ? message.slice(0, MAX_MESSAGE_LENGTH) + "..."
      : message;
  }
  function pushLog(level, type, message) {
    if (state.logs.length < MAX_LOGS_PER_TICK) {
      state.logs.push({ level: level, type: type, message: truncate(message) });
    }
  }
  function num(v) { return typeof v === "number" ? v : Number(v); }
  function take(action) {
    if (state.actionTaken) {
      pushLog("warn", "MULTIPLE_ACTIONS", "only the first action per tick is applied");
      return;
    }
    state.actionTaken = true;
    state.actions.push(action);
  }
  function makePlayer(data, isMe) {
    var p = {
      position: data.position,
      hasBall: data.hasBall,
      slot: data.slot,
      team: data.team,
      isClosestToBall: function() { return data.isClosestToBall === true; }
    };
    if (isMe) {
      p.moveToward = function(x, y) { take({ type: "moveToward", x: num(x), y: num(y) }); };
      p.moveTo = p.moveToward;
      p.stop = function() { take({ type: "stop" }); };
      p.dribble = function(x, y) {
        if (state.actionTaken) {
          pushLog("warn", "MULTIPLE_ACTIONS", "only the first action per tick is applied");
          return;
        }
        if (!p.hasBall) {
          pushLog("warn", "DRIBBLE_NO_BALL", "dribble ignored: player does not have the ball");
          return;
        }
        take({ type: "dribble", x: num(x), y: num(y) });
      };
      p.shoot = function(x, y, power) {
        if (state.actionTaken) {
          pushLog("warn", "MULTIPLE_ACTIONS", "only the first action per tick is applied");
          return;
        }
        if (!p.hasBall) {
          pushLog("warn", "SHOOT_NO_BALL", "shoot ignored: player does not have the ball");
          return;
        }
        var pw = num(power);
        if (!isFinite(pw)) pw = 1;
        pw = Math.min(1, Math.max(0.1, pw));
        take({ type: "shoot", x: num(x), y: num(y), power: pw });
      };
    }
    return p;
  }
  globalThis.__run = function(data) {
    state.actions = [];
    state.logs = [];
    state.actionTaken = false;
    var game = {
      me: makePlayer(data.me, true),
      ball: { position: data.ball.position, velocity: data.ball.velocity, owner: data.ball.owner },
      teammates: [],
      opponents: [],
      field: data.field
    };
    for (var i = 0; i < data.players.length; i++) {
      var d = data.players[i];
      if (d.slot === data.me.slot && d.team === data.me.team) continue;
      (d.team === data.me.team ? game.teammates : game.opponents).push(makePlayer(d, false));
    }
    globalThis.console = {
      log: function() { pushLog("log", "CONSOLE", Array.prototype.map.call(arguments, serialize).join(" ")); },
      warn: function() { pushLog("warn", "CONSOLE", Array.prototype.map.call(arguments, serialize).join(" ")); },
      error: function() { pushLog("error", "CONSOLE", Array.prototype.map.call(arguments, serialize).join(" ")); }
    };
    var error = null;
    if (typeof update !== "function") {
      error = "missing update function";
    } else {
      try {
        update(game);
      } catch (err) {
        error = err && err.message ? err.message : String(err);
      }
    }
    return JSON.stringify({ actions: state.actions, logs: state.logs, error: error });
  };
})();
`;
