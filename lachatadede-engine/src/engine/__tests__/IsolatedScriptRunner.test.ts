import { describe, expect, it } from 'vitest';
import { IsolatedScriptRunner, extractErrorLine } from '../IsolatedScriptRunner.js';
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

function prepareAwayRunner(
  code: string,
  options = {},
): { run: (overrides?: Partial<ScriptTickContext>) => ReturnType<IsolatedScriptRunner['runTick']> } {
  const runner = new IsolatedScriptRunner({ tickTimeoutMs: 1000, ...options });
  const scripts = makeScripts((slot, team) => (slot === 3 && team === 'opponent' ? code : ''));
  runner.prepare(scripts);
  return { run: (overrides = {}) => runner.runTick(0, makeContext(overrides)) };
}

function consoleScript(expression: string): string {
  return `function update(game) {\n  console.log(JSON.stringify(${expression}));\n}`;
}

function loggedMessage(logs: FrameLog[], team: 'challenger' | 'opponent' = 'challenger'): string {
  expect(logs).toHaveLength(1);
  const entry = logs[0] as FrameLog;
  expect(entry.team).toBe(team);
  expect(entry.level).toBe('log');
  expect(entry.type).toBe('CONSOLE');
  return entry.message;
}

describe('IsolatedScriptRunner - script-ia-api v3.0 game context (AC #1, #3)', () => {
  it('provides me, ball, teammates, opponents and field to the script', () => {
    const { run } = prepareRunner(
      consoleScript(
        `{
        me: { position: game.me.position, slot: game.me.slot, isTeammate: game.me.isTeammate },
        ball: { position: game.ball.position, velocity: game.ball.velocity, owner: game.ball.owner },
        teammates: game.teammates.length,
        opponents: game.opponents.length,
        field: { width: game.field.width, height: game.field.height,
                 ownGoal: game.field.ownGoal, opponentGoal: game.field.opponentGoal,
                 ownBox: !!game.field.ownBox, center: game.field.center }
      }`,
      ),
    );
    const { logs } = run();
    const data = JSON.parse(loggedMessage(logs)) as {
      me: { position: { x: number; y: number }; slot: number; isTeammate: boolean };
      ball: { position: { x: number; y: number }; velocity: { vx: number; vy: number }; owner: null };
      teammates: number;
      opponents: number;
      field: { width: number; height: number; ownGoal: { x: number }; opponentGoal: { x: number }; ownBox: boolean; center: { x: number } };
    };
    expect(data.me).toEqual({ position: { x: 5, y: 25 }, slot: 1, isTeammate: true });
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
      ownGoal: { x: 0, y: 25, width: 20 },
      opponentGoal: { x: 100, y: 25, width: 20 },
      ownBox: true,
      center: { x: 50, y: 25 },
    });
  });

  it('resolves the ball owner to the actual player object (ball.owner === me)', () => {
    const { run } = prepareRunner(
      consoleScript(`{ isMe: game.ball.owner === game.me, slot: game.ball.owner.slot }`),
    );
    const { logs } = run({
      ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 1, team: 'challenger' } },
    });
    expect(JSON.parse(loggedMessage(logs))).toEqual({ isMe: true, slot: 1 });
  });

  it('resolves a teammate owner to the same object as the teammates entry', () => {
    const { run } = prepareRunner(
      consoleScript(`{
        inRoster: game.teammates.some(function (p) { return p === game.ball.owner; }),
        isTeammate: game.ball.owner.isTeammate,
        slot: game.ball.owner.slot
      }`),
    );
    const { logs } = run({
      ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 2, team: 'challenger' } },
    });
    expect(JSON.parse(loggedMessage(logs))).toEqual({ inRoster: true, isTeammate: true, slot: 2 });
  });

  it('resolves an opponent owner with isTeammate false', () => {
    const { run } = prepareRunner(
      consoleScript(`{
        inRoster: game.opponents.some(function (p) { return p === game.ball.owner; }),
        isTeammate: game.ball.owner.isTeammate,
        slot: game.ball.owner.slot
      }`),
    );
    const { logs } = run({
      ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 3, team: 'opponent' } },
    });
    expect(JSON.parse(loggedMessage(logs))).toEqual({ inRoster: true, isTeammate: false, slot: 3 });
  });

  it('exposes action methods on me only; teammates and opponents are read-only', () => {
    const { run } = prepareRunner(
      consoleScript(`{
        meMove: typeof game.me.moveToward,
        meDribble: typeof game.me.dribble,
        meStop: typeof game.me.stop,
        meShoot: typeof game.me.shoot,
        teammateAction: typeof game.teammates[0].moveToward,
        opponentAction: typeof game.opponents[0].shoot
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
    });
  });

  it('does not provide kick, kickBall, moveTo, hasBall, team or isClosestToBall (v3.0 removals)', () => {
    const { run } = prepareRunner(
      consoleScript(`{
        kick: typeof game.me.kick,
        kickBall: typeof game.me.kickBall,
        moveTo: typeof game.me.moveTo,
        hasBall: typeof game.me.hasBall,
        team: typeof game.me.team,
        closest: typeof game.me.isClosestToBall,
        playerTeam: typeof game.teammates[0].team,
        playerHasBall: typeof game.opponents[0].hasBall
      }`),
    );
    const { logs } = run();
    expect(JSON.parse(loggedMessage(logs))).toEqual({
      kick: 'undefined',
      kickBall: 'undefined',
      moveTo: 'undefined',
      hasBall: 'undefined',
      team: 'undefined',
      closest: 'undefined',
      playerTeam: 'undefined',
      playerHasBall: 'undefined',
    });
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

describe('IsolatedScriptRunner - perfect mirror membrane (story 8.5)', () => {
  it('mirrors the away seat view: own goal at x=0, teammates near it, velocity flipped', () => {
    const { run } = prepareAwayRunner(
      consoleScript(`{
        meX: game.me.position.x,
        gkX: game.teammates[0].position.x,
        ball: game.ball.position,
        velocity: game.ball.velocity,
        ownGoal: game.field.ownGoal.x,
        opponentGoal: game.field.opponentGoal.x
      }`),
    );
    // Opponent slot 3 at world x=80 -> ego x=20; ball world (70, 25, vx -0.5)
    // -> ego (30, 25, vx +0.5).
    const { logs } = run({
      ball: { x: 70, y: 25, vx: -0.5, vy: 0.25, owner: null },
    });
    expect(JSON.parse(loggedMessage(logs, 'opponent'))).toEqual({
      meX: 20,
      gkX: 5,
      ball: { x: 30, y: 25 },
      velocity: { vx: 0.5, vy: 0.25 },
      ownGoal: 0,
      opponentGoal: 100,
    });
  });

  it('un-mirrors away-seat moveToward/dribble/shoot x back to world space', () => {
    // The away script aims at ITS opponent goal in the ego frame (x=100,
    // world x=0); the host must translate the target back to world space.
    const move = prepareAwayRunner(`function update(game) { game.me.moveToward(90, 25); }`).run();
    expect(move.actions).toEqual([
      { team: 'opponent', slot: 3, action: { type: 'moveToward', x: 10, y: 25 } },
    ]);

    const owned = {
      ball: { x: 80, y: 25, vx: 0, vy: 0, owner: { slot: 3, team: 'opponent' as const } },
    };
    const dribble = prepareAwayRunner(`function update(game) { game.me.dribble(30, 12); }`).run(owned);
    expect(dribble.actions).toEqual([
      { team: 'opponent', slot: 3, action: { type: 'dribble', x: 70, y: 12 } },
    ]);

    const shoot = prepareAwayRunner(
      `function update(game) { game.me.shoot(100, 20, 1.0); }`,
    ).run(owned);
    expect(shoot.actions).toEqual([
      { team: 'opponent', slot: 3, action: { type: 'shoot', x: 0, y: 20, power: 1 } },
    ]);
  });

  it('keeps the challenger seat in world orientation (no transform either way)', () => {
    const { run } = prepareRunner(`function update(game) { game.me.moveToward(90, 25); }`);
    expect(run().actions).toEqual([
      { team: 'challenger', slot: 1, action: { type: 'moveToward', x: 90, y: 25 } },
    ]);
  });

  it('lets an away script resolve possession and shoot at its ego opponent goal', () => {
    // End-to-end membrane round trip: away carrier aims at world x=0 through
    // the ego frame; dribble guard works through the resolved owner identity.
    const { run } = prepareAwayRunner(
      `function update(game) {
        if (game.ball.owner === game.me) { game.me.shoot(100, 25, 0.9); }
        else { game.me.moveToward(game.ball.position.x, game.ball.position.y); }
      }`,
    );
    const owned = run({
      ball: { x: 80, y: 25, vx: 0, vy: 0, owner: { slot: 3, team: 'opponent' } },
    });
    expect(owned.actions).toEqual([
      { team: 'opponent', slot: 3, action: { type: 'shoot', x: 0, y: 25, power: 0.9 } },
    ]);
    expect(owned.logs).toHaveLength(0);

    const free = run({ ball: { x: 70, y: 30, vx: 0, vy: 0, owner: null } });
    expect(free.actions).toEqual([
      { team: 'opponent', slot: 3, action: { type: 'moveToward', x: 70, y: 30 } },
    ]);
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

  it('dribbles and shoots normally when the player owns the ball (owner identity check)', () => {
    const { run } = prepareRunner(
      `function update(game) { if (game.ball.owner === game.me) game.me.dribble(10, 10); }`,
    );
    const owned = { ball: { x: 50, y: 25, vx: 0, vy: 0, owner: { slot: 1, team: 'challenger' as const } } };
    expect(run(owned).actions).toEqual([
      { team: 'challenger', slot: 1, action: { type: 'dribble', x: 10, y: 10 } },
    ]);
    expect(run(owned).logs).toHaveLength(0);
  });

  it('clamps shoot power into [0.1, 1.0]', () => {
    const { run } = prepareRunner(
      `function update(game) { if (game.ball.owner === game.me) game.me.shoot(100, 25, game.me.slot === 1 ? 5 : 0.5); }`,
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
