/**
 * Docs situations generator (Epic 8.1 + the 8.2 field diagram).
 *
 * Runs the REAL deterministic engine on five minimal situations and writes
 * the raw frame files consumed by docs/scripting.md. No hand-written
 * positions: every frame comes from Simulation.stepTick(). Also emits
 * field-coordinates.svg built from the real FIELD_DATA constants.
 *
 * Run: npm run docs:frames (engine workspace)
 */
import fs from 'node:fs';
import path from 'node:path';
import { Simulation } from '../src/engine/Simulation.js';
import { FIELD_DATA } from '../src/engine/contextBuilder.js';
import { FIELD_HEIGHT, FIELD_WIDTH, GOAL_Y_MAX, GOAL_Y_MIN } from '../src/engine/constants.js';
import type { Frame, SimulatePayload, SlotAction } from '../src/engine/types.js';
import type { ScriptRunner, ScriptTickContext } from '../src/engine/ScriptRunner.js';

type Decide = (tick: number, ctx: ScriptTickContext) => SlotAction[];

class ScriptedRunner implements ScriptRunner {
  constructor(private readonly decide: Decide) {}
  prepare(): void {}
  runTick(tick: number, context: ScriptTickContext): { actions: SlotAction[]; logs: [] } {
    return { actions: this.decide(tick, context), logs: [] };
  }
}

interface Situation {
  name: string;
  ticks: number;
  build: () => { payload: SimulatePayload; decide: Decide };
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function payload(matchId: string, challenger: SimulatePayload['challenger'], opponent: SimulatePayload['opponent']): SimulatePayload {
  return { match_id: matchId, seed: 42, output_path: '.', challenger, opponent };
}

const SITUATIONS: Situation[] = [
  {
    name: 'move-toward',
    ticks: 120,
    build: () => ({
      payload: payload('doc-move-toward', { players: [{ slot: 2, x: 30, y: 25, script: '' }] }, { players: [] }),
      decide: () => [{ team: 'challenger', slot: 2, action: { type: 'moveToward', x: 70, y: 25 } }],
    }),
  },
  {
    name: 'dribble',
    ticks: 200,
    build: () => {
      const waypoints = [
        { x: 45, y: 15 },
        { x: 55, y: 35 },
        { x: 65, y: 15 },
      ];
      let next = 0;
      return {
        payload: payload('doc-dribble', { players: [{ slot: 2, x: 35, y: 25, script: '' }] }, { players: [] }),
        decide: (_tick, ctx) => {
          const me = ctx.players.find((p) => p.team === 'challenger' && p.slot === 2);
          const wp = waypoints[Math.min(next, waypoints.length - 1)];
          if (!me || !wp) return [];
          if (next < waypoints.length - 1 && dist(me.x, me.y, wp.x, wp.y) < 1.5) next++;
          const target = waypoints[next];
          if (!target) return [];
          return [{ team: 'challenger', slot: 2, action: { type: 'dribble', x: target.x, y: target.y } }];
        },
      };
    },
  },
  {
    name: 'shoot',
    ticks: 125,
    build: () => ({
      payload: payload(
        'doc-shoot',
        { players: [{ slot: 2, x: 55, y: 25, script: '' }] },
        { players: [{ slot: 1, x: 98, y: 20, script: '' }] },
      ),
      decide: (tick) => [
        tick < 40
          ? { team: 'challenger', slot: 2, action: { type: 'dribble', x: 65, y: 25 } }
          : tick === 40
            ? { team: 'challenger', slot: 2, action: { type: 'shoot', x: 100, y: 32, power: 1.0 } }
            : { team: 'challenger', slot: 2, action: { type: 'stop' } },
        // The keeper centers on his line, freezes when the shot is away —
        // beaten by the corner anyway.
        tick < 40
          ? { team: 'opponent', slot: 1, action: { type: 'moveToward', x: 98, y: 25 } }
          : { team: 'opponent', slot: 1, action: { type: 'stop' } },
      ],
    }),
  },
  {
    name: 'stop',
    ticks: 70,
    build: () => ({
      payload: payload('doc-stop', { players: [{ slot: 2, x: 30, y: 25, script: '' }] }, { players: [] }),
      decide: (tick, ctx) =>
        tick < 40
          ? [{ team: 'challenger', slot: 2, action: { type: 'moveToward', x: ctx.ball.x, y: ctx.ball.y } }]
          : [{ team: 'challenger', slot: 2, action: { type: 'stop' } }],
    }),
  },
  {
    name: 'versus',
    ticks: 130,
    build: () => {
      let moverHeld = false;
      return {
        payload: payload(
          'doc-versus',
          { players: [{ slot: 2, x: 35, y: 24, script: '' }] },
          { players: [{ slot: 2, x: 35, y: 26, script: '' }] },
        ),
        decide: (_tick, ctx) => {
          const mover: SlotAction = (() => {
            if (ctx.ball.owner === null && !moverHeld) {
              return { team: 'challenger', slot: 2, action: { type: 'moveToward', x: ctx.ball.x, y: ctx.ball.y } };
            }
            moverHeld = true;
            return { team: 'challenger', slot: 2, action: { type: 'stop' } };
          })();
          const dribblerOwns = ctx.ball.owner?.team === 'opponent' && ctx.ball.owner?.slot === 2;
          const dribbler: SlotAction = dribblerOwns
            ? { team: 'opponent', slot: 2, action: { type: 'dribble', x: 70, y: 25 } }
            : { team: 'opponent', slot: 2, action: { type: 'moveToward', x: ctx.ball.x, y: ctx.ball.y } };
          return [mover, dribbler];
        },
      };
    },
  },
];

function runSituation(situation: Situation): { frames: Frame[]; summary: string } {
  const built = situation.build();
  const runner = new ScriptedRunner(built.decide);
  const sim = new Simulation(built.payload, runner);

  // Stage the situation on the public seams (the constructor's seeded
  // kickoff already ran; these overrides are the Simulation.test.ts pattern).
  if (situation.name === 'move-toward') sim.ball.reset(50, 12);
  if (situation.name === 'dribble') {
    sim.ball.reset(35, 25);
    sim.ball.giveTo({ slot: 2, team: 'challenger' });
  }
  if (situation.name === 'shoot') {
    sim.ball.reset(55, 25);
    sim.ball.giveTo({ slot: 2, team: 'challenger' });
  }
  if (situation.name === 'stop') {
    sim.ball.reset(45, 25);
    sim.ball.vx = 0.5;
  }
  if (situation.name === 'versus') sim.ball.reset(50, 25);

  const frames: Frame[] = [];
  for (let i = 0; i < situation.ticks; i++) {
    frames.push(sim.stepTick());
  }
  // A goal resets positions (kickoff): the doc file ends on the celebration
  // tail instead of showing the reset.
  const goalIndex = frames.findIndex((f) => f.events.some((e) => e.type === 'goal'));
  let trimmed = false;
  if (goalIndex !== -1 && goalIndex + 8 < frames.length) {
    frames.length = goalIndex + 8;
    trimmed = true;
  }
  const events = frames.flatMap((f) => f.events);
  const last = frames[frames.length - 1];
  const lines = [
    `  events: ${events.length === 0 ? 'none' : events.map((e) => JSON.stringify(e)).join(' | ')}`,
    `  final ball: (${last.ball.x.toFixed(2)}, ${last.ball.y.toFixed(2)})`,
    ...last.players.map(
      (p) => `  final p${p.slot} ${p.team}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) ${p.state}`,
    ),
  ];
  if (trimmed) lines.push(`  trimmed at goal frame ${goalIndex} (+8 celebration tail)`);
  return { frames, summary: lines.join('\n') };
}

function writeSituationFile(outDir: string, situation: Situation, frames: Frame[]): void {
  const file = {
    match_id: `doc-${situation.name}`,
    seed: 42,
    total_frames: frames.length,
    frames,
  };
  fs.writeFileSync(path.join(outDir, `${situation.name}.json`), `${JSON.stringify(file, null, 2)}\n`);
}

function fieldCoordinatesSvg(): string {
  const M = 8;
  const W = FIELD_WIDTH;
  const H = FIELD_HEIGHT;
  const gx = (x: number): string => (M + x).toFixed(1);
  const gy = (y: number): string => (M - 4 + y).toFixed(1);
  const stripes: string[] = [];
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 1) {
      stripes.push(`<rect x="${gx(i * 10)}" y="${gy(0)}" width="10" height="${H}" fill="#379c56"/>`);
    }
  }
  const zone = (z: { x1: number; y1: number; x2: number; y2: number }): string =>
    `<rect x="${gx(z.x1)}" y="${gy(z.y1)}" width="${z.x2 - z.x1}" height="${z.y2 - z.y1}" fill="none" stroke="#ffe9a8" stroke-width="0.5" stroke-dasharray="2 1.4"/>`;
  const xTicks = [0, 25, 50, 75, 100]
    .map((v) => `<text x="${gx(v)}" y="${gy(H) + 5}" text-anchor="middle">${v}</text>`)
    .join('');
  const yTicks = [0, 25, 50]
    .map((v) => `<text x="${M - 2.5}" y="${gy(v) + 1}" text-anchor="end">${v}</text>`)
    .join('');
  const goalMouth = (x: number): string =>
    `<line x1="${gx(x)}" y1="${gy(GOAL_Y_MIN)}" x2="${gx(x)}" y2="${gy(GOAL_Y_MAX)}" stroke="#ffffff" stroke-width="1.8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(2 * M + W).toFixed(0)} ${(2 * M - 2 + H).toFixed(0)}" font-family="ui-monospace, monospace" font-size="3.4" fill="#eaf6ee">
  <rect x="0" y="0" width="${(2 * M + W).toFixed(0)}" height="${(2 * M - 2 + H).toFixed(0)}" fill="rgb(15, 25, 32)" rx="4"/>
  <rect x="${gx(0)}" y="${gy(0)}" width="${W}" height="${H}" fill="#3fae62"/>
  ${stripes.join('\n  ')}
  <rect x="${gx(0)}" y="${gy(0)}" width="${W}" height="${H}" fill="none" stroke="#ffffff" stroke-width="0.7"/>
  <line x1="${gx(50)}" y1="${gy(0)}" x2="${gx(50)}" y2="${gy(H)}" stroke="#ffffff" stroke-width="0.5"/>
  <circle cx="${gx(50)}" cy="${gy(25)}" r="8" fill="none" stroke="#ffffff" stroke-width="0.5"/>
  <circle cx="${gx(50)}" cy="${gy(25)}" r="0.8" fill="#ffffff"/>
  ${goalMouth(0)}
  ${goalMouth(FIELD_WIDTH)}
  ${zone(FIELD_DATA.zones.homeBox)}
  ${zone(FIELD_DATA.zones.awayBox)}
  <text x="${gx(1.5)}" y="${gy(13.5)}">homeBox</text>
  <text x="${gx(W - 8.5)}" y="${gy(13.5)}">awayBox</text>
  <text x="${gx(0)}" y="${gy(GOAL_Y_MAX) + 4}">goal: y ${GOAL_Y_MIN}-${GOAL_Y_MAX}</text>
  ${xTicks}
  ${yTicks}
  <text x="${gx(102)}" y="${gy(-1.5)}">x</text>
  <text x="${M - 6.4}" y="${gy(1.5)}">y</text>
</svg>
`;
}

function main(): void {
  const outDir = path.resolve(import.meta.dirname, '../../docs/scripting/frames');
  fs.mkdirSync(outDir, { recursive: true });
  const imgDir = path.resolve(import.meta.dirname, '../../docs/scripting/img');
  fs.mkdirSync(imgDir, { recursive: true });

  for (const situation of SITUATIONS) {
    const { frames, summary } = runSituation(situation);
    writeSituationFile(outDir, situation, frames);
    console.log(`${situation.name}: ${frames.length} frames\n${summary}`);
  }
  fs.writeFileSync(path.join(imgDir, 'field-coordinates.svg'), fieldCoordinatesSvg());
  console.log('field-coordinates.svg written');
}

main();
