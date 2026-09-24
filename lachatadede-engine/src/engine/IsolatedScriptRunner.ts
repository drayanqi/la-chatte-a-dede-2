import ivm from 'isolated-vm';
import {
  FIELD_WIDTH,
  MAX_LOGS_PER_MATCH,
  MEMORY_LIMIT_MB,
  MATCH_TIME_BUDGET_MS,
  SCRIPT_INIT_TIMEOUT_MS,
  SHOOT_POWER_MAX,
  SHOOT_POWER_MIN,
  TICK_TIMEOUT_MS,
} from './constants.js';
import {
  PREAMBLE_LINE_OFFSET,
  SCRIPT_PREAMBLE,
  SCRIPT_SHIM,
  buildTeamTickData,
} from './contextBuilder.js';
import type { PlayerScript, ScriptRunner, ScriptTickContext, TickOutcome } from './ScriptRunner.js';
import type { FrameLog, PlayerAction, SlotAction, Team } from './types.js';

export interface IsolatedScriptRunnerOptions {
  /** Per-script V8 heap limit in MB (AC #3). */
  memoryLimitMb?: number;
  /** Per-tick execution deadline in ms (AC #2). */
  tickTimeoutMs?: number;
  /** Top-level (bundle initialization) deadline in ms. */
  initTimeoutMs?: number;
  /** Total-match wall-clock budget in ms (AC #4). */
  matchBudgetMs?: number;
}

interface RawAction {
  type: string;
  x?: unknown;
  y?: unknown;
  power?: unknown;
}

interface RawLog {
  level?: unknown;
  type?: unknown;
  message?: unknown;
}

interface RawRunResult {
  actions?: RawAction[];
  logs?: RawLog[];
  error?: string | null;
}

type PlayerStatus = 'active' | 'error' | 'memory' | 'watchdog' | 'noscript';

interface RunnerPlayer {
  team: SlotAction['team'];
  slot: number;
  isolate: ivm.Isolate | null;
  /** Reference to the in-isolate __run(data) shim entry point. */
  run: ivm.Reference<(data: unknown) => string> | null;
  status: PlayerStatus;
  /**
   * Script error detected outside of a tick (compile failure, missing update,
   * init timeout/memory). Logged once on the first tick, then the player is
   * skipped for the rest of the match.
   */
  deferredError: FrameLog | null;
}

const TIMEOUT_PATTERN = /script execution timed out/i;
const MEMORY_PATTERN = /memory limit|isolate[ds]? (was )?disposed/i;

/**
 * Sandboxed script execution with isolated-vm (story 3.4).
 *
 * - One isolate per player per match, 8MB heap limit, bundle compiled once.
 * - Per tick, each active player's `__run` shim is invoked synchronously
 *   against a copied snapshot of the game state with a 10ms deadline.
 * - Tick timeout: the tick is skipped, the player keeps playing (AC #2).
 * - Memory limit exceeded: isolate disposed, player disabled for the match.
 * - Compile/runtime error (SCRIPT_ERROR): player disabled for the match,
 *   error recorded once with the tick (frame index) and slot (AC #1).
 * - 30s wall-clock watchdog: every remaining player is disabled and the
 *   simulation continues to completion with everyone idle; the problem is
 *   surfaced via `matchErrors` so the /simulate response can mark it (AC #4).
 *
 * Determinism note: the watchdog is the only wall-clock-dependent behavior and
 * exists as a resource-protection hard cap mandated by the story. The physics
 * and simulation core never read the clock; determinism tests use workloads
 * that stay far below the budget.
 */
export class IsolatedScriptRunner implements ScriptRunner {
  /** Match-level execution problems, appended to the /simulate response. */
  readonly matchErrors: string[] = [];

  private readonly players: RunnerPlayer[] = [];
  private readonly memoryLimitMb: number;
  private readonly tickTimeoutMs: number;
  private readonly initTimeoutMs: number;
  private readonly matchBudgetMs: number;
  private startedAt = 0;
  private watchdogTripped = false;
  private logsEmitted = 0;

  constructor(options: IsolatedScriptRunnerOptions = {}) {
    this.memoryLimitMb = options.memoryLimitMb ?? MEMORY_LIMIT_MB;
    this.tickTimeoutMs = options.tickTimeoutMs ?? TICK_TIMEOUT_MS;
    this.initTimeoutMs = options.initTimeoutMs ?? SCRIPT_INIT_TIMEOUT_MS;
    this.matchBudgetMs = options.matchBudgetMs ?? MATCH_TIME_BUDGET_MS;
  }

  prepare(scripts: PlayerScript[]): void {
    this.startedAt = performance.now();
    for (const script of scripts) {
      const player: RunnerPlayer = {
        team: script.team,
        slot: script.slot,
        isolate: null,
        run: null,
        status: 'active',
        deferredError: null,
      };
      this.players.push(player);
      this.compilePlayer(player, script.code);
    }
  }

  runTick(tick: number, context: ScriptTickContext): TickOutcome {
    if (this.watchdogTripped) return { actions: [], logs: this.flushDeferredErrors() };
    if (performance.now() - this.startedAt > this.matchBudgetMs) {
      this.tripWatchdog(tick);
      return { actions: [], logs: this.flushDeferredErrors() };
    }

    const actions: SlotAction[] = [];
    const logs: FrameLog[] = [];

    for (const player of this.players) {
      if (player.deferredError !== null) {
        logs.push(player.deferredError);
        player.deferredError = null;
        continue;
      }
      if (player.status !== 'active' || player.run === null) continue;

      const tickData = buildTeamTickData(context, player.team, player.slot);
      let resultJson: string;
      try {
        resultJson = player.run.applySync(undefined, [tickData], {
          timeout: this.tickTimeoutMs,
          arguments: { copy: true },
          result: { copy: true },
        });
      } catch (err) {
        const errorLog = this.classifyIsolateError(player, err, false);
        if (errorLog !== null) logs.push(errorLog);
        continue;
      }

      const result = this.parseRunResult(resultJson);
      for (const raw of result.logs) {
        logs.push({
          team: player.team,
          slot: player.slot,
          level: raw.level,
          type: raw.type,
          message: raw.message,
        });
      }
      if (result.error !== null) {
        player.status = 'error';
        logs.push({
          team: player.team,
          slot: player.slot,
          level: 'error',
          type: 'SCRIPT_ERROR',
          message: `${result.error}; player disabled for the rest of the match`,
        });
        this.disposePlayer(player);
        continue;
      }
      if (result.actions.length > 0) {
        const action = this.toWorldAction(result.actions[0] as RawAction, player.team);
        if (action !== null) {
          actions.push({ team: player.team, slot: player.slot, action });
        }
      }
    }

    // Match-level log cap: a chatty script must not blow up the frame data.
    return { actions, logs: this.applyLogCap(logs) };
  }

  /**
   * Emits any pending out-of-tick errors (compile failure, missing update)
   * even when the watchdog path skips the per-player loop, so a deferred
   * SCRIPT_ERROR is never silently dropped.
   */
  private flushDeferredErrors(): FrameLog[] {
    const logs: FrameLog[] = [];
    for (const player of this.players) {
      if (player.deferredError !== null) {
        logs.push(player.deferredError);
        player.deferredError = null;
      }
    }
    return this.applyLogCap(logs);
  }

  /**
   * Match-level log cap (deterministic, count-based): once
   * MAX_LOGS_PER_MATCH entries have been emitted, further logs are dropped
   * and a single LOG_CAP warning is emitted instead.
   */
  private applyLogCap(logs: FrameLog[]): FrameLog[] {
    if (this.logsEmitted >= MAX_LOGS_PER_MATCH) return [];
    const room = MAX_LOGS_PER_MATCH - this.logsEmitted;
    if (logs.length <= room) {
      this.logsEmitted += logs.length;
      return logs;
    }
    const kept = logs.slice(0, room);
    this.logsEmitted = MAX_LOGS_PER_MATCH;
    kept.push({
      team: 'challenger',
      slot: 0,
      level: 'warn',
      type: 'LOG_CAP',
      message: `match log limit of ${MAX_LOGS_PER_MATCH} entries reached; further script logs are dropped`,
    });
    return kept;
  }

  /** Releases every isolate. Called by the route layer when the match ends. */
  dispose(): void {
    for (const player of this.players) {
      this.disposePlayer(player);
    }
  }

  private compilePlayer(player: RunnerPlayer, code: string): void {
    // A blank script is a legitimate "idle player": nothing executes and
    // nothing is logged for the whole match.
    if (code.trim() === '') {
      player.status = 'noscript';
      return;
    }
    let isolate: ivm.Isolate | null = null;
    try {
      isolate = new ivm.Isolate({ memoryLimit: this.memoryLimitMb });
      const context = isolate.createContextSync();
      const bundle = `${SCRIPT_PREAMBLE}${code}${SCRIPT_SHIM}`;
      const compiled = isolate.compileScriptSync(bundle, { filename: 'player-script.js' });
      compiled.runSync(context, { timeout: this.initTimeoutMs });
      if (context.evalSync('typeof update') !== 'function') {
        player.status = 'error';
        player.deferredError = {
          team: player.team,
          slot: player.slot,
          level: 'error',
          type: 'SCRIPT_ERROR',
          message: 'missing update function; player idle for the match',
        };
        // Release the compiled isolate: nothing references it anymore.
        player.isolate = isolate;
        this.disposePlayer(player);
        return;
      }
      player.isolate = isolate;
      player.run = context.global.getSync('__run', {
        reference: true,
      }) as ivm.Reference<(data: unknown) => string>;
    } catch (err) {
      player.isolate = isolate;
      player.deferredError = this.classifyIsolateError(player, err, true);
    }
  }

  /**
   * Classifies an isolate failure and disables the player when required
   * (AC #1-#3). Returns the log entry to record for the failure, or null:
   *  - tick timeout: SCRIPT_TIMEOUT, the player skips the tick and keeps playing
   *  - init timeout: SCRIPT_ERROR, player disabled (initialization never finished)
   *  - memory limit: SCRIPT_MEMORY, isolate disposed, player disabled for the match
   *  - anything else (compile/runtime): SCRIPT_ERROR, player disabled
   */
  private classifyIsolateError(player: RunnerPlayer, err: unknown, init: boolean): FrameLog | null {
    const message = err instanceof Error ? err.message : String(err);
    if (TIMEOUT_PATTERN.test(message)) {
      if (init) {
        player.status = 'error';
        this.disposePlayer(player);
        return {
          team: player.team,
          slot: player.slot,
          level: 'error',
          type: 'SCRIPT_ERROR',
          message: 'script timed out during initialization; player idle for the match',
        };
      }
      // Tick timeout: skip this tick, the player keeps playing (AC #2).
      return {
        team: player.team,
        slot: player.slot,
        level: 'error',
        type: 'SCRIPT_TIMEOUT',
        message: `script exceeded the ${this.tickTimeoutMs}ms tick time limit`,
      };
    }
    if (MEMORY_PATTERN.test(message)) {
      player.status = 'memory';
      this.disposePlayer(player);
      return {
        team: player.team,
        slot: player.slot,
        level: 'error',
        type: 'SCRIPT_MEMORY',
        message: `script exceeded the ${this.memoryLimitMb}MB memory limit; player disabled for the rest of the match`,
      };
    }
    const line = extractErrorLine(err, PREAMBLE_LINE_OFFSET);
    player.status = 'error';
    this.disposePlayer(player);
    return {
      team: player.team,
      slot: player.slot,
      level: 'error',
      type: 'SCRIPT_ERROR',
      message: `${line === null ? message : `${message} (line ${line})`}; player disabled for the rest of the match`,
    };
  }

  private tripWatchdog(tick: number): void {
    this.watchdogTripped = true;
    this.matchErrors.push(
      `match wall-clock budget of ${this.matchBudgetMs}ms exceeded at tick ${tick}; all players disabled for the rest of the match`,
    );
    for (const player of this.players) {
      if (player.status === 'active') player.status = 'watchdog';
      this.disposePlayer(player);
    }
  }

  private parseRunResult(resultJson: string): {
    actions: RawAction[];
    logs: { level: FrameLog['level']; type: string; message: string }[];
    error: string | null;
  } {
    let parsed: RawRunResult;
    try {
      parsed = JSON.parse(resultJson) as RawRunResult;
    } catch {
      return { actions: [], logs: [], error: 'unparseable script result' };
    }
    const logs: { level: FrameLog['level']; type: string; message: string }[] = [];
    for (const raw of Array.isArray(parsed.logs) ? parsed.logs : []) {
      const level = raw.level === 'warn' || raw.level === 'error' ? raw.level : 'log';
      logs.push({
        level,
        type: typeof raw.type === 'string' ? raw.type : 'CONSOLE',
        message: typeof raw.message === 'string' ? raw.message : String(raw.message),
      });
    }
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const error = typeof parsed.error === 'string' && parsed.error.length > 0 ? parsed.error : null;
    return { actions, logs, error };
  }

  private toPlayerAction(raw: RawAction): PlayerAction | null {
    const x = typeof raw.x === 'number' ? raw.x : Number.NaN;
    const y = typeof raw.y === 'number' ? raw.y : Number.NaN;
    switch (raw.type) {
      case 'moveToward':
        return { type: 'moveToward', x, y };
      case 'dribble':
        return { type: 'dribble', x, y };
      case 'shoot': {
        let power = typeof raw.power === 'number' ? raw.power : Number.NaN;
        if (!Number.isFinite(power)) power = 1;
        power = Math.min(SHOOT_POWER_MAX, Math.max(SHOOT_POWER_MIN, power));
        return { type: 'shoot', x, y, power };
      }
      case 'stop':
        return { type: 'stop' };
      default:
        return null;
    }
  }

  /**
   * Story 8.5 membrane, output half: the away seat scripts in its ego frame
   * (own goal at x=0, attacks toward x=100), so its coordinate actions are
   * un-mirrored back to world space (x -> 100 - x). The challenger seat is
   * already in world orientation and passes through untouched; `stop` carries
   * no coordinates. The transform set is CLOSED over the coordinate actions:
   * a future action type carrying coordinates must be added here explicitly
   * (and to contextBuilder's mirrored tick data) or it will throw — a new
   * membrane half is never silently half-wired.
   */
  private toWorldAction(raw: RawAction, team: Team): PlayerAction | null {
    const action = this.toPlayerAction(raw);
    if (action === null || team !== 'opponent') return action;
    switch (action.type) {
      case 'moveToward':
      case 'dribble':
      case 'shoot':
        return { ...action, x: FIELD_WIDTH - action.x };
      case 'stop':
        return action;
      default: {
        // Exhaustiveness guard: a coordinate action added to toPlayerAction
        // without a membrane decision must fail loudly, not pass through.
        const exhaustive: never = action;
        throw new Error(`un-mirrored action type reached the membrane: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  private disposePlayer(player: RunnerPlayer): void {
    if (player.isolate !== null) {
      // An isolate that died from memory exhaustion is already disposed and
      // throws on a second dispose call; treat that as success.
      try {
        player.isolate.dispose();
      } catch {
        /* already disposed */
      }
      player.isolate = null;
    }
    player.run = null;
    if (player.status === 'active') player.status = 'error';
  }
}

/**
 * Extracts the 1-based source line from an error message ending in
 * ` [name.js:line:column]` (V8 SyntaxError format), adjusted by `lineOffset`
 * host-side preamble lines.
 */
export function extractErrorLine(err: unknown, lineOffset = 0): number | null {
  if (!(err instanceof Error)) return null;
  const match = /\[(?:[^\][\s]+):(\d+):\d+\]\s*$/.exec(err.message);
  if (match === null) return null;
  const bundleLine = Number.parseInt(match[1] as string, 10);
  const userLine = bundleLine - lineOffset;
  return userLine >= 1 ? userLine : null;
}
