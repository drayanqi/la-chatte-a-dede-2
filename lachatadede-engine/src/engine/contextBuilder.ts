import type { ScriptTickContext } from './ScriptRunner.js';
import { FIELD_WIDTH } from './constants.js';
import type { Team } from './types.js';

/**
 * Host side of the script-ia-api.md v3.0 contract (ego-centric, story 8.5).
 *
 * Each tick, for each player, a plain-data snapshot is built on the host and
 * deep-copied into the player's isolate. The in-isolate shim (SCRIPT_SHIM
 * below) turns that raw data into the `game` object the script sees, attaching
 * action methods to `me` only and resolving `ball.owner` to the actual player
 * object. The copy is the isolation boundary: scripts can mutate what they
 * receive without affecting the simulation or other players.
 *
 * The contract is a PERFECT MIRROR (Pelo's law, story 8.5): every script lives
 * in its own attacking frame — own goal at x=0, opponent goal at x=100, always
 * attacking left to right. The challenger seat sees world coordinates as-is
 * (the payload places it defending x=0); the opponent seat sees the pitch
 * mirrored (x -> 100 - x, vx -> -vx) and its coordinate actions are
 * un-mirrored back to world space by the host (IsolatedScriptRunner). Scripts
 * never know which side they play: no home/away vocabulary exists in the
 * script view.
 */

export interface ScriptPlayerData {
  slot: number;
  position: { x: number; y: number };
  /** True for the viewer and their teammates, false for opponents. */
  isTeammate: boolean;
}

export interface ScriptFieldData {
  width: number;
  height: number;
  ownGoal: { x: number; y: number; width: number };
  opponentGoal: { x: number; y: number; width: number };
  ownBox: { x1: number; y1: number; x2: number; y2: number };
  opponentBox: { x1: number; y1: number; x2: number; y2: number };
  center: { x: number; y: number };
}

export interface ScriptBallData {
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  /**
   * The ball owner relative to the viewer — resolved by the shim into the
   * actual player object, so `ball.owner === me` works in scripts.
   */
  owner: { side: 'me' | 'teammate' | 'opponent'; slot: number } | null;
}

export interface TeamTickData {
  me: ScriptPlayerData;
  teammates: ScriptPlayerData[];
  opponents: ScriptPlayerData[];
  ball: ScriptBallData;
  field: ScriptFieldData;
}

/**
 * Field description per script-ia-api.md v3.0 (goal width = GOAL_Y_MAX -
 * GOAL_Y_MIN). The ego frame is IDENTICAL for both seats: own goal at x=0.
 */
export const FIELD_DATA: ScriptFieldData = {
  width: 100,
  height: 50,
  ownGoal: { x: 0, y: 25, width: 20 },
  opponentGoal: { x: 100, y: 25, width: 20 },
  ownBox: { x1: 0, y1: 15, x2: 16, y2: 35 },
  opponentBox: { x1: 84, y1: 15, x2: 100, y2: 35 },
  center: { x: 50, y: 25 },
};

/**
 * Builds the per-viewer tick data for one player (story 8.5 membrane).
 *
 * The world stays untouched — mirroring happens ONLY here and in the
 * un-mirroring of the away seat's actions (IsolatedScriptRunner). The
 * challenger view equals world coordinates; the opponent view is mirrored
 * across the halfway line (x and vx), so both seats see their own goal at
 * x=0 and attack toward x=100.
 */
export function buildTeamTickData(
  context: ScriptTickContext,
  team: Team,
  slot: number,
): TeamTickData {
  const mirror = team === 'opponent';
  const mx = (x: number): number => (mirror ? FIELD_WIDTH - x : x);
  const toPlayer = (p: ScriptTickContext['players'][number]): ScriptPlayerData => ({
    slot: p.slot,
    position: { x: mx(p.x), y: p.y },
    isTeammate: p.team === team,
  });
  const mine = context.players.filter((p) => p.team === team);
  const me = mine.find((p) => p.slot === slot);
  if (me === undefined) {
    throw new Error(`no player data for team ${team} slot ${slot}`);
  }
  const owner = context.ball.owner;
  return {
    me: toPlayer(me),
    teammates: mine.filter((p) => p.slot !== slot).map(toPlayer),
    opponents: context.players.filter((p) => p.team !== team).map(toPlayer),
    ball: {
      position: { x: mx(context.ball.x), y: context.ball.y },
      velocity: {
        vx: mirror ? -context.ball.vx : context.ball.vx,
        vy: context.ball.vy,
      },
      owner:
        owner === null
          ? null
          : {
              side:
                owner.team === team ? (owner.slot === slot ? 'me' : 'teammate') : 'opponent',
              slot: owner.slot,
            },
    },
    field: FIELD_DATA,
  };
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
 *  1. builds the script-ia-api.md v3.0 `game` object from the raw tick data,
 *     resolving `ball.owner` into the actual player object (identity holds
 *     within the tick: `ball.owner === me` when the viewer carries the ball)
 *  2. wraps `me` with action methods that record actions/warnings
 *  3. captures console.log/warn/error per tick
 *  4. exposes the game object as globalThis.game (scripts can read `game`
 *     anywhere, including helper functions, without a parameter) and calls
 *     update(game), catching runtime errors
 *  5. returns a JSON string: { actions, logs, error }
 *
 * Action rules (script-ia-api.md):
 *  - only the FIRST recorded action of a tick applies; later calls get a
 *    MULTIPLE_ACTIONS warning
 *  - dribble/shoot without possession produce DRIBBLE_NO_BALL / SHOOT_NO_BALL
 *    and are ignored (they do not consume the one-action budget)
 *  - kick/kickBall are deliberately NOT provided (and the v2 `moveTo` alias
 *    is gone — story 8.5)
 */
export const SCRIPT_SHIM = `
;(function() {
  "use strict";
  var state = { actions: [], logs: [], actionTaken: false };
  var iHaveTheBall = false;
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
      slot: data.slot,
      isTeammate: data.isTeammate === true
    };
    if (isMe) {
      p.moveToward = function(x, y) { take({ type: "moveToward", x: num(x), y: num(y) }); };
      p.stop = function() { take({ type: "stop" }); };
      p.dribble = function(x, y) {
        if (state.actionTaken) {
          pushLog("warn", "MULTIPLE_ACTIONS", "only the first action per tick is applied");
          return;
        }
        if (!iHaveTheBall) {
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
        if (!iHaveTheBall) {
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
  function resolveOwner(owner) {
    if (owner === null) return null;
    if (owner.side === "me") return __me;
    var pool = owner.side === "teammate" ? __teammates : __opponents;
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].slot === owner.slot) return pool[i];
    }
    return null;
  }
  var __me = null;
  var __teammates = [];
  var __opponents = [];
  globalThis.__run = function(data) {
    state.actions = [];
    state.logs = [];
    state.actionTaken = false;
    iHaveTheBall = data.ball.owner !== null && data.ball.owner.side === "me";
    __teammates = [];
    __opponents = [];
    __me = makePlayer(data.me, true);
    for (var i = 0; i < data.teammates.length; i++) {
      __teammates.push(makePlayer(data.teammates[i], false));
    }
    for (var j = 0; j < data.opponents.length; j++) {
      __opponents.push(makePlayer(data.opponents[j], false));
    }
    var game = {
      me: __me,
      ball: { position: data.ball.position, velocity: data.ball.velocity, owner: resolveOwner(data.ball.owner) },
      teammates: __teammates,
      opponents: __opponents,
      field: data.field
    };
    globalThis.console = {
      log: function() { pushLog("log", "CONSOLE", Array.prototype.map.call(arguments, serialize).join(" ")); },
      warn: function() { pushLog("warn", "CONSOLE", Array.prototype.map.call(arguments, serialize).join(" ")); },
      error: function() { pushLog("error", "CONSOLE", Array.prototype.map.call(arguments, serialize).join(" ")); }
    };
    var error = null;
    if (typeof update !== "function") {
      error = "missing update function";
    } else {
      globalThis.game = game;
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
