import { describe, expect, it } from 'vitest';
import { IsolatedScriptRunner, extractErrorLine } from '../IsolatedScriptRunner.js';
import { buildSharedTickData } from '../contextBuilder.js';
import type { PlayerScript, ScriptTickContext } from '../ScriptRunner.js';
import type { FrameLog } from '../types.js';

function makePlayers(): ScriptTickContext['players'] {
  return [
    { slot: 1, team: 'challenger', x: 5, y: 25 },
    { slot: 2, team: 'challenger', x: 20, y: 10 },
    { slot: 3, team: 'challenger', x: 20, y: 25 },
    { slot: 4, team: 'challenger', x: 20, y: 40 },
    { slot: 5, team: 'challenger', x: 30, y: 25 },
    { slot: 1, team: 'opponent', x: 95, y: 25 },
    { slot: 2, team: 'opponent', x: 80, y: 10 },
    { slot: 3, team: 'opponent', x: 80, y: 25 },
    { slot: 4, team: 'opponent', x: 80, y: 40 },
    { slot: 5, team: 'opponent', x: 70, y: 25 },
  ];
}

function makeContext(overrides: Partial<ScriptTickContext> = {}): ScriptTickContext {
  return {
    tick: 0,
    ball: { x: 50, y: 25, vx: 0, vy: 0, owner: null },
    players: makePlayers(),
    ...overrides,
  };
}

function makeScripts(
  code: (slot: number, team: 'challenger' | 'opponent') => string = () => '',
): PlayerScript[] {
  return [
    ...makePlayers().map((p) => ({
      slot: p.slot,
      team: p.team,
      code: code(p.slot, p.team),
    })),
  ];
}

function prepareRunner(
  code: string,
  options = {},
): { runner: IsolatedScriptRunner; run: (overrides?: Partial<ScriptTickContext>) => ReturnType<IsolatedScriptRunner['runTick']> } {
  // Generous tick deadline: these tests assert script BEHAVIOR, not the 10ms
  // value (pinned in constants.test.ts). Under a loaded machine even a
  // trivial script can exceed a 10ms wall-clock deadline and would flake.
  const runner = new IsolatedScriptRunner({ tickTimeoutMs: 1000, ...options });
  // Only challenger slot 1 gets the script; everyone else is idle.
  const scripts = makeScripts((slot, team) => (slot === 1 && team === 'challenger' ? code : ''));
  runner.prepare(scripts);
  return { runner, run: (overrides = {}) => runner.runTick(0, makeContext(overrides)) };
}

function consoleScript(expression: string): string {
  return `function update(game) {\n  console.log(JSON.stringify(${expression}));\n}`;
}

function loggedMessage(logs: FrameLog[]): string {
  expect(logs).toHaveLength(1);
  const entry = logs[0] as FrameLog;
  expect(entry.team).toBe('challenger');
  expect(entry.slot).toBe(1);
  expect(entry.level).toBe('log');
  expect(entry.type).toBe('CONSOLE');
  return entry.message;
}

describe('contextBuilder - buildSharedTickData', () => {
  it('maps engine teams to script teams and exposes the owner as a player id string', () => {
    const shared = buildSharedTickData(
      makeContext({ ball: { x: 50, y: 25, vx: 1, vy: -1, owner: { slot: 3, team: 'opponent' } } }),
    );
    expect(shared.ball).toEqual({
      position: { x: 50, y: 25 },
      velocity: { vx: 1, vy: -1 },
      owner: 'away-3',
    });
    expect(shared.players[0]?.team).toBe('home');
    expect(shared.players[5]?.team).toBe('away');
    expect(shared.field).toEqual({
      width: 100,
      height: 50,
      goals: { home: { x: 0, y: 25, width: 20 }, away: { x: 100, y: 25, width: 20 } },
      zones: {
        homeBox: { x1: 0, y1: 15, x2: 16, y2: 35 },
        awayBox: { x1: 84, y1: 15, x2: 100, y2: 35 },
        center: { x: 50, y: 25 },
      },
    });
  });

  it('computes hasBall from the ball owner', () => {
    const shared = buildSharedTickData(
      makeContext({ ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 2, team: 'challenger' } } }),
    );
    expect(shared.players.map((p) => p.hasBall)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('computes isClosestToBall within the team, resolving ties by the lower slot', () => {
    // Slot 1 at (5,25) and slot 2 at (7,25) are both 1.0 from the ball at (6,25).
    const players = makePlayers();
    players[0] = { slot: 1, team: 'challenger', x: 5, y: 25 };
    players[1] = { slot: 2, team: 'challenger', x: 7, y: 25 };
    const shared = buildSharedTickData(
      makeContext({ players, ball: { x: 6, y: 25, vx: 0, vy: 0, owner: null } }),
    );
    const challenger = shared.players.slice(0, 5);
    expect(challenger.map((p) => p.isClosestToBall)).toEqual([true, false, false, false, false]);
  });

  it('marks the closest player of each team independently', () => {
    const players = makePlayers();
    players[0] = { slot: 1, team: 'challenger', x: 55, y: 25 }; // closest challenger
    players[5] = { slot: 1, team: 'opponent', x: 45, y: 25 }; // closest opponent
    const shared = buildSharedTickData(makeContext({ players }));
    expect(shared.players[0]?.isClosestToBall).toBe(true);
    expect(shared.players[5]?.isClosestToBall).toBe(true);
  });
});

describe('IsolatedScriptRunner - script-ia-api game context (AC #1)', () => {
  it('provides me, ball, teammates, opponents and field to the script', () => {
    const { run } = prepareRunner(
      consoleScript(
        `{
        me: { position: game.me.position, hasBall: game.me.hasBall, slot: game.me.slot, team: game.me.team },
        ball: { position: game.ball.position, velocity: game.ball.velocity, owner: game.ball.owner },
        teammates: game.teammates.length,
        opponents: game.opponents.length,
        field: { width: game.field.width, height: game.field.height,
                 homeGoal: game.field.goals.home, zones: !!game.field.zones.homeBox }
      }`,
      ),
    );
    const { logs } = run();
    const data = JSON.parse(loggedMessage(logs)) as {
      me: { position: { x: number; y: number }; hasBall: boolean; slot: number; team: string };
      ball: { position: { x: number; y: number }; velocity: { vx: number; vy: number }; owner: null };
      teammates: number;
      opponents: number;
      field: { width: number; height: number; homeGoal: { x: number; y: number; width: number }; zones: boolean };
    };
    expect(data.me).toEqual({ position: { x: 5, y: 25 }, hasBall: false, slot: 1, team: 'home' });
    expect(data.ball).toEqual({
      position: { x: 50, y: 25 },
      velocity: { vx: 0, vy: 0 },
      owner: null,
    });
    expect(data.teammates).toBe(4); // excludes self
    expect(data.opponents).toBe(5);
    expect(data.field).toEqual({
      width: 100,
      height: 50,
      homeGoal: { x: 0, y: 25, width: 20 },
      zones: true,
    });
  });

  it('reflects possession in me.hasBall and ball.owner', () => {
    const { run } = prepareRunner(
      consoleScript(`{ hasBall: game.me.hasBall, owner: game.ball.owner }`),
    );
    const { logs } = run({
      ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 1, team: 'challenger' } },
    });
    expect(JSON.parse(loggedMessage(logs))).toEqual({ hasBall: true, owner: 'home-1' });
  });

  it('exposes action methods on me only; teammates and opponents are read-only', () => {
    const { run } = prepareRunner(
      consoleScript(`{
        meMove: typeof game.me.moveToward,
        meDribble: typeof game.me.dribble,
        meStop: typeof game.me.stop,
        meShoot: typeof game.me.shoot,
        teammateAction: typeof game.teammates[0].moveToward,
        opponentAction: typeof game.opponents[0].shoot,
        teammateClosest: typeof game.teammates[0].isClosestToBall
      }`),
    );
    const { logs } = run();
    expect(JSON.parse(loggedMessage(logs))).toEqual({
      meMove: 'function',
      meDribble: 'function',
      meStop: 'function',
      meShoot: 'function',
      teammateAction: 'undefined',
      opponentAction: 'undefined',
      teammateClosest: 'function',
    });
  });

  it('does not provide kick or kickBall on any player', () => {
    const { run } = prepareRunner(
      consoleScript(`{ kick: typeof game.me.kick, kickBall: typeof game.me.kickBall }`),
    );
    const { logs } = run();
    expect(JSON.parse(loggedMessage(logs))).toEqual({ kick: 'undefined', kickBall: 'undefined' });
  });

  it('supports the isClosestToBall() engine-computed helper', () => {
    const { run } = prepareRunner(consoleScript(`{ closest: game.me.isClosestToBall() }`));
    // Challenger slot 1 at (5,25) stands on the ball -> it is the closest.
    const { logs } = run({ ball: { x: 5, y: 25, vx: 0, vy: 0, owner: null } });
    expect(JSON.parse(loggedMessage(logs))).toEqual({ closest: true });
  });

  it('captures console.log/warn/error per player per tick', () => {
    const { runner, run } = prepareRunner(
      `function update(game) {
        console.log('tick-log', 42);
        console.warn({ warned: true });
        console.error('bad');
      }`,
    );
    const outcome = run();
    expect(outcome.logs).toHaveLength(3);
    expect(outcome.logs[0]).toMatchObject({
      team: 'challenger',
      slot: 1,
      level: 'log',
      type: 'CONSOLE',
      message: 'tick-log 42',
    });
    expect(outcome.logs[1]).toMatchObject({ level: 'warn', message: '{"warned":true}' });
    expect(outcome.logs[2]).toMatchObject({ level: 'error', message: 'bad' });

    // Each tick captures fresh console output.
    const next = runner.runTick(1, makeContext());
    expect(next.logs).toHaveLength(3);
  });

  it('exposes the game object as a global usable by param-less scripts', () => {
    const { run } = prepareRunner(`function update() { game.me.stop(); }`);
    const { actions, logs } = run();
    expect(actions).toEqual([{ team: 'challenger', slot: 1, action: { type: 'stop' } }]);
    expect(logs).toHaveLength(0);
  });

  it('gives helper functions the current tick state through the global game', () => {
    const { run } = prepareRunner(
      `function ballX() { return game.ball.position.x; }
       function update() { console.log(JSON.stringify({ x: ballX(), opponents: game.opponents.length })); }`,
    );
    const { logs } = run({ ball: { x: 33, y: 25, vx: 0, vy: 0, owner: null } });
    expect(JSON.parse(loggedMessage(logs))).toEqual({ x: 33, opponents: 5 });
  });

  it('rebinds the global game to the fresh snapshot on every tick', () => {
    const { runner } = prepareRunner(
      `function update() { console.log(JSON.stringify(game.ball.position.x)); }`,
    );
    const first = runner.runTick(0, makeContext({ ball: { x: 10, y: 25, vx: 0, vy: 0, owner: null } }));
    const second = runner.runTick(1, makeContext({ ball: { x: 77, y: 25, vx: 0, vy: 0, owner: null } }));
    expect(loggedMessage(first.logs)).toBe('10');
    expect(loggedMessage(second.logs)).toBe('77');
  });
});

describe('IsolatedScriptRunner - action selection and warnings (AC #5)', () => {
  it('applies only the first action and warns MULTIPLE_ACTIONS for later calls', () => {
    const { run } = prepareRunner(
      `function update(game) {
        game.me.moveToward(50, 25);
        game.me.shoot(100, 25, 1.0);
        game.me.stop();
      }`,
    );
    const { actions, logs } = run();
    expect(actions).toHaveLength(1);
    expect(actions[0]?.action).toEqual({ type: 'moveToward', x: 50, y: 25 });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ level: 'warn', type: 'MULTIPLE_ACTIONS' });
    expect(logs[1]).toMatchObject({ level: 'warn', type: 'MULTIPLE_ACTIONS' });
  });

  it('warns DRIBBLE_NO_BALL and ignores the dribble when the player has no ball', () => {
    const { run } = prepareRunner(
      `function update(game) { game.me.dribble(10, 10); }`,
    );
    const { actions, logs } = run();
    expect(actions).toHaveLength(0);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ level: 'warn', type: 'DRIBBLE_NO_BALL' });
  });

  it('warns SHOOT_NO_BALL and ignores the shot when the player has no ball', () => {
    const { run } = prepareRunner(`function update(game) { game.me.shoot(100, 25, 1.0); }`);
    const { actions, logs } = run();
    expect(actions).toHaveLength(0);
    expect(logs[0]).toMatchObject({ level: 'warn', type: 'SHOOT_NO_BALL' });
  });

  it('lets a valid action run after an invalid one (invalid calls do not consume the tick budget)', () => {
    const { run } = prepareRunner(
      `function update(game) {
        game.me.dribble(10, 10);
        game.me.moveToward(20, 20);
      }`,
    );
    const { actions, logs } = run();
    expect(actions).toEqual([
      { team: 'challenger', slot: 1, action: { type: 'moveToward', x: 20, y: 20 } },
    ]);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.type).toBe('DRIBBLE_NO_BALL');
  });

  it('dribbles and shoots normally when the player owns the ball', () => {
    const { run } = prepareRunner(`function update(game) { game.me.dribble(10, 10); }`);
    const owned = { ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 1, team: 'challenger' as const } } };
    expect(run(owned).actions).toEqual([
      { team: 'challenger', slot: 1, action: { type: 'dribble', x: 10, y: 10 } },
    ]);
    expect(run(owned).logs).toHaveLength(0);
  });

  it('provides moveTo as a compatibility alias of moveToward', () => {
    const { run } = prepareRunner(`function update(game) { game.me.moveTo(30, 30); }`);
    expect(run().actions).toEqual([
      { team: 'challenger', slot: 1, action: { type: 'moveToward', x: 30, y: 30 } },
    ]);
  });

  it('clamps shoot power into [0.1, 1.0]', () => {
    const { run } = prepareRunner(
      `function update(game) { if (game.me.hasBall) game.me.shoot(100, 25, game.me.slot === 1 ? 5 : 0.5); }`,
    );
    const owned = { ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 1, team: 'challenger' as const } } };
    const { actions } = run(owned);
    expect(actions[0]?.action).toEqual({ type: 'shoot', x: 100, y: 25, power: 1 });

    const { run: runLow } = prepareRunner(
      `function update(game) { game.me.shoot(100, 25, 0.01); }`,
    );
    expect(runLow(owned).actions[0]?.action).toEqual({ type: 'shoot', x: 100, y: 25, power: 0.1 });
  });

  it('produces no actions when the script calls none (inertia is handled by the engine)', () => {
    const { run } = prepareRunner(`function update(game) { void game; }`);
    const { actions, logs } = run();
    expect(actions).toHaveLength(0);
    expect(logs).toHaveLength(0);
  });
});

describe('IsolatedScriptRunner - sandbox escapes (AC #1)', () => {
  it.each([
    ['require', `function update(game) { require('fs'); }`],
    ['process', `function update(game) { process.exit(1); }`],
    ['fetch', `function update(game) { fetch('http://evil.example'); }`],
    ['globals', `function update(game) { console.log(typeof global.process); }`],
  ])('%s is unavailable and produces a SCRIPT_ERROR instead of a crash', (_name, code) => {
    const { runner, run } = prepareRunner(code);
    const first = run();
    expect(first.actions).toHaveLength(0);
    expect(first.logs).toHaveLength(1);
    expect(first.logs[0]?.level).toBe('error');
    expect(first.logs[0]?.type).toBe('SCRIPT_ERROR');
    // Disabled for the rest of the match: no repeated errors, no actions.
    const second = runner.runTick(1, makeContext());
    expect(second).toEqual({ actions: [], logs: [] });
  });

  it('rejects escape attempts at the top level during initialization', () => {
    const { run } = prepareRunner(`process.exit(0);\nfunction update(game) { void game; }`);
    const { actions, logs } = run();
    expect(actions).toHaveLength(0);
    expect(logs[0]).toMatchObject({ level: 'error', type: 'SCRIPT_ERROR' });
  });

  it('isolates failures between players', () => {
    const runner = new IsolatedScriptRunner({ tickTimeoutMs: 1000 });
    const evil: PlayerScript = { slot: 1, team: 'challenger', code: `function update(game) { require('fs'); }` };
    const healthy: PlayerScript = {
      slot: 2,
      team: 'challenger',
      code: consoleScript(`'healthy'`),
    };
    runner.prepare([evil, healthy]);
    const outcome = runner.runTick(0, makeContext());
    expect(outcome.actions).toHaveLength(0);
    expect(outcome.logs).toHaveLength(2);
    expect(outcome.logs[0]).toMatchObject({ slot: 1, type: 'SCRIPT_ERROR' });
    expect(outcome.logs[1]).toMatchObject({ slot: 2, level: 'log', message: '"healthy"' });
     });
});

describe('IsolatedScriptRunner - limits (AC #2, #3, #4)', () => {
  it('terminates an infinite loop for the tick only and the player keeps playing', () => {
    const { runner, run } = prepareRunner(`function update(game) { while (true) {} }`, {
      tickTimeoutMs: 200,
    });
    const first = run();
    expect(first.actions).toHaveLength(0);
    expect(first.logs).toHaveLength(1);
    expect(first.logs[0]).toMatchObject({
      level: 'error',
      type: 'SCRIPT_TIMEOUT',
      team: 'challenger',
      slot: 1,
    });
    // Next tick the player is tried again (same outcome, not disabled).
    const second = runner.runTick(1, makeContext());
    expect(second.logs[0]?.type).toBe('SCRIPT_TIMEOUT');
  });

  it('disables the player permanently when the memory limit is exceeded (AC #3)', () => {
    const { runner, run } = prepareRunner(
      `function update(game) {
        const chunks = [];
        while (true) { chunks.push(new Array(1000000).fill(1.1)); }
      }`,
      // Long tick deadline so the failure mode is the memory limit (not the
      // 10ms default timeout racing the allocator on a loaded machine).
      { memoryLimitMb: 8, tickTimeoutMs: 2000 },
    );
    const first = run();
    expect(first.actions).toHaveLength(0);
    expect(first.logs).toHaveLength(1);
    expect(first.logs[0]).toMatchObject({
      level: 'error',
      type: 'SCRIPT_MEMORY',
      team: 'challenger',
      slot: 1,
    });
    // Disabled for the remaining match: no repeated error, no actions.
    const second = runner.runTick(1, makeContext());
    expect(second).toEqual({ actions: [], logs: [] });
    const third = runner.runTick(2, makeContext());
    expect(third).toEqual({ actions: [], logs: [] });
  });

  it('records SCRIPT_ERROR once for a missing update function', () => {
    const { runner, run } = prepareRunner(`var x = 1;`);
    const first = run();
    expect(first.logs).toHaveLength(1);
    expect(first.logs[0]).toMatchObject({ level: 'error', type: 'SCRIPT_ERROR', message: expect.stringContaining('missing update function') });
    expect(runner.runTick(1, makeContext()).logs).toHaveLength(0);
  });

  it('reports syntax errors with the user-code line number', () => {
    const { run } = prepareRunner(`function update(game) {\n  return function {;\n}`);
    const { logs } = run();
    expect(logs[0]).toMatchObject({ level: 'error', type: 'SCRIPT_ERROR' });
    expect(logs[0]?.message).toContain('line 2');
  });

  it('treats blank scripts as idle players with no output', () => {
    const { run } = prepareRunner('');
    expect(run()).toEqual({ actions: [], logs: [] });
    expect(run()).toEqual({ actions: [], logs: [] });
  });

  it('trips the 30s watchdog: all players disabled, matchErrors marked (AC #4)', async () => {
    const runner = new IsolatedScriptRunner({ matchBudgetMs: 0, tickTimeoutMs: 1000 });
    runner.prepare([
      { slot: 1, team: 'challenger', code: consoleScript(`'alive'`) },
      { slot: 2, team: 'challenger', code: '' },
    ]);
    // Let the wall clock advance past the (zero) budget.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const tripped = runner.runTick(7, makeContext());
    expect(tripped).toEqual({ actions: [], logs: [] });
    expect(runner.matchErrors).toHaveLength(1);
    expect(runner.matchErrors[0]).toContain('tick 7');
    // Every subsequent tick runs idle.
    expect(runner.runTick(8, makeContext())).toEqual({ actions: [], logs: [] });
  });

  it('does not trip the watchdog while within budget', () => {
    const runner = new IsolatedScriptRunner({ matchBudgetMs: 60_000, tickTimeoutMs: 1000 });
    runner.prepare([{ slot: 1, team: 'challenger', code: consoleScript(`'x'`) }]);
    const outcome = runner.runTick(0, makeContext());
    expect(outcome.logs).toHaveLength(1);
    expect(runner.matchErrors).toHaveLength(0);
  });
});

describe('extractErrorLine', () => {
  it('extracts the source line from isolated-vm syntax error messages', () => {
    const err = new Error("Unexpected token '{' [player-script.js:3:7]");
    expect(extractErrorLine(err, 1)).toBe(2);
    expect(extractErrorLine(err, 0)).toBe(3);
  });

  it('returns null for unrelated errors', () => {
    expect(extractErrorLine(new Error('boom'))).toBeNull();
    expect(extractErrorLine('boom')).toBeNull();
  });
});
