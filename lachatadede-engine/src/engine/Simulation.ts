import { BallState, type BallOwner } from './BallState.js';
import {
  CENTER_CIRCLE_RADIUS,
  CENTER_X,
  CENTER_Y,
  COLLISION_RADIUS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_Y_MAX,
  GOAL_Y_MIN,
  PLAYER_SPEED,
  TOTAL_TICKS,
} from './constants.js';
import {
  NoopScriptRunner,
  type PlayerScript,
  type ScriptRunner,
  type ScriptTickContext,
  type TickOutcome,
} from './ScriptRunner.js';
import { SeededRandom } from './seededRandom.js';
import type {
  Frame,
  FrameEvent,
  FramePlayer,
  PlayerAction,
  PlayerActionState,
  SimulatePayload,
  SimulationFrameFile,
  Team,
} from './types.js';

interface PlayerEntity {
  slot: number;
  team: Team;
  x: number;
  y: number;
  initialX: number;
  initialY: number;
  state: PlayerActionState;
}

function otherTeam(team: Team): Team {
  return team === 'challenger' ? 'opponent' : 'challenger';
}

/**
 * Deterministic match simulation.
 *
 * Per game-rules.md "Sequence de Jeu", every tick:
 *  1. seeded shuffle of the player execution order
 *  2. collect actions from the ScriptRunner
 *  3. apply actions
 *  4. update positions
 *  5. ball possession check (COLLISION_RADIUS)
 *  6. ball physics (friction, edge rebounds)
 *  7. goal check -> kickoff reset after a goal
 *  8. record frame
 *
 * Determinism rules: the seeded PRNG is the only randomness source, no
 * Date.now()/Math.random() inside the loop, arrays only (no iteration-order
 * dependent Set/Map), and the same operation order every tick.
 */
export class Simulation {
  readonly ball: BallState;
  private readonly payload: SimulatePayload;
  private readonly runner: ScriptRunner;
  private readonly rng: SeededRandom;
  private readonly players: PlayerEntity[];
  private scoreChallengerValue = 0;
  private scoreOpponentValue = 0;
  private tick = 0;
  private currentEvents: FrameEvent[] = [];
  private currentLogs: string[] = [];

  constructor(payload: SimulatePayload, runner: ScriptRunner = new NoopScriptRunner()) {
    this.payload = payload;
    this.runner = runner;
    this.rng = new SeededRandom(payload.seed);
    this.ball = new BallState(CENTER_X, CENTER_Y);
    this.players = [
      ...payload.challenger.players.map((p) => this.toEntity(p, 'challenger')),
      ...payload.opponent.players.map((p) => this.toEntity(p, 'opponent')),
    ];
    // Initial kickoff: decided by the seed (game-rules.md).
    this.kickoffTeam(this.rng.next() < 0.5 ? 'challenger' : 'opponent');
  }

  get scoreChallenger(): number {
    return this.scoreChallengerValue;
  }

  get scoreOpponent(): number {
    return this.scoreOpponentValue;
  }

  /** Advances exactly one tick and returns the recorded frame. Public for tests. */
  stepTick(): Frame {
    const currentTick = this.tick;
    // 1. Seeded shuffle of the execution order (game-rules.md step 1).
    const order = this.rng.shuffle(this.players);
    // 2. Collect actions from the ScriptRunner (pre-tick state snapshot).
    const outcome = this.runner.runTick(currentTick, this.buildContext(currentTick));
    // 3-4. Apply actions and update positions.
    this.applyActions(outcome, order);
    // 5. Ball possession check (free ball only).
    if (this.ball.isFree) this.checkPossession();
    // 6. Ball physics.
    this.ball.step();
    // 7. Goal check (may trigger kickoff reset).
    this.checkGoal();
    // 8. Record frame.
    const frame = this.recordFrame(currentTick);
    this.tick++;
    return frame;
  }

  /** Runs the full match (TOTAL_TICKS ticks) and returns the frame file content. */
  async run(): Promise<SimulationFrameFile> {
    await this.runner.prepare(this.collectScripts());
    const frames: Frame[] = new Array(TOTAL_TICKS);
    for (let i = 0; i < TOTAL_TICKS; i++) {
      frames[i] = this.stepTick();
    }
    const { score_challenger, score_opponent, winner } = this.buildResult();
    return {
      match_id: this.payload.match_id,
      seed: this.payload.seed,
      total_frames: frames.length,
      result: { score_challenger, score_opponent, winner },
      frames,
    };
  }

  private toEntity(p: { slot: number; x: number; y: number }, team: Team): PlayerEntity {
    return { slot: p.slot, team, x: p.x, y: p.y, initialX: p.x, initialY: p.y, state: 'idle' };
  }

  private collectScripts(): PlayerScript[] {
    return [
      ...this.payload.challenger.players.map((p) => ({ slot: p.slot, team: 'challenger' as const, code: p.script })),
      ...this.payload.opponent.players.map((p) => ({ slot: p.slot, team: 'opponent' as const, code: p.script })),
    ];
  }

  private buildContext(tick: number): ScriptTickContext {
    const owner = this.ball.owner;
    return {
      tick,
      ball: {
        x: this.ball.x,
        y: this.ball.y,
        owner: owner === null ? null : { slot: owner.slot, team: owner.team },
      },
      players: this.players.map((p) => ({ slot: p.slot, team: p.team, x: p.x, y: p.y })),
    };
  }

  private applyActions(outcome: TickOutcome, order: PlayerEntity[]): void {
    const seen = new Set<string>();
    for (const { team, slot, action } of outcome.actions) {
      const key = `${team}:${slot}`;
      if (seen.has(key)) continue; // duplicate action for a slot: first one wins
      seen.add(key);
      const player = order.find((p) => p.team === team && p.slot === slot);
      if (player === undefined) continue; // unknown slot: ignore
      this.applyAction(player, action);
    }
  }

  private applyAction(player: PlayerEntity, action: PlayerAction): void {
    switch (action.type) {
      case 'moveToward': {
        if (!this.isValidTarget(action.x, action.y)) break; // non-finite target: ignore
        this.movePlayer(player, action.x, action.y);
        player.state = 'moving';
        // moveToward with the ball loses possession (game-rules.md).
        if (this.isOwner(player)) this.ball.release();
        break;
      }
      case 'dribble': {
        if (!this.isValidTarget(action.x, action.y)) break;
        this.movePlayer(player, action.x, action.y);
        player.state = 'moving';
        // Dribbling drags the ball along; possession is kept.
        if (this.isOwner(player)) {
          this.ball.x = player.x;
          this.ball.y = player.y;
        }
        break;
      }
      case 'shoot': {
        if (!this.isValidTarget(action.x, action.y)) break;
        player.state = 'action';
        if (this.isOwner(player)) this.ball.shoot(action.x, action.y);
        break;
      }
      case 'stop': {
        player.state = 'action';
        break;
      }
    }
  }

  private isValidTarget(x: number, y: number): boolean {
    // A non-finite target would poison positions permanently (NaN propagates).
    return Number.isFinite(x) && Number.isFinite(y);
  }

  private isOwner(player: PlayerEntity): boolean {
    const owner = this.ball.owner;
    return owner !== null && owner.slot === player.slot && owner.team === player.team;
  }

  private movePlayer(player: PlayerEntity, tx: number, ty: number): void {
    const dx = tx - player.x;
    const dy = ty - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= PLAYER_SPEED) {
      player.x = tx;
      player.y = ty;
    } else {
      player.x += (dx / dist) * PLAYER_SPEED;
      player.y += (dy / dist) * PLAYER_SPEED;
    }
    // Players never leave the field; clamping also keeps a dribbled ball inside.
    player.x = Math.min(FIELD_WIDTH, Math.max(0, player.x));
    player.y = Math.min(FIELD_HEIGHT, Math.max(0, player.y));
  }

  private checkPossession(): void {
    // Players within COLLISION_RADIUS of the free ball can take possession.
    const releaser = this.ball.releasedBy;
    const candidates = this.players.filter((p) => {
      // While the release exemption is active, the releaser cannot re-collect
      // the ball they dropped or shot (game-rules.md: moveToward loses
      // possession). Once they are out of reach the exemption expires (below)
      // and normal possession rules apply again.
      if (releaser !== null && p.slot === releaser.slot && p.team === releaser.team) {
        return false;
      }
      return this.distanceToBall(p) <= COLLISION_RADIUS;
    });
    // The exemption expires once the releaser is out of reach.
    if (releaser !== null) {
      const releaserPlayer = this.players.find(
        (p) => p.slot === releaser.slot && p.team === releaser.team,
      );
      if (releaserPlayer === undefined || this.distanceToBall(releaserPlayer) > COLLISION_RADIUS) {
        this.ball.releasedBy = null;
      }
    }
    if (candidates.length === 0) return;
    let winner: PlayerEntity;
    if (candidates.length === 1) {
      winner = candidates[0] as PlayerEntity;
    } else {
      // Contested possession: the seeded RNG decides (game-rules.md).
      winner = this.rng.shuffle(candidates)[0] as PlayerEntity;
    }
    const owner: BallOwner = { slot: winner.slot, team: winner.team };
    this.ball.giveTo(owner);
  }

  private checkGoal(): void {
    const crossing = this.ball.goalCrossing;
    let scoringTeam: Team | null = null;
    if (crossing !== null) {
      // The free ball's trajectory crossed a goal line inside the mouth this
      // tick (right = x=100 -> challenger, left = x=0 -> opponent).
      scoringTeam = crossing.side === 'right' ? 'challenger' : 'opponent';
    } else {
      // Owned balls never integrate (dribble sync), so judge by position.
      const inGoalMouth = this.ball.y >= GOAL_Y_MIN && this.ball.y <= GOAL_Y_MAX;
      if (!inGoalMouth) return;
      if (this.ball.x >= FIELD_WIDTH) {
        scoringTeam = 'challenger';
      } else if (this.ball.x <= 0) {
        scoringTeam = 'opponent';
      }
    }
    if (scoringTeam === null) return;
    if (scoringTeam === 'challenger') this.scoreChallengerValue++;
    else this.scoreOpponentValue++;
    this.currentEvents.push({
      type: 'goal',
      team: scoringTeam,
      scorerSlot: this.ball.lastTouch?.slot ?? -1,
    });
    // Conceding team kicks off (game-rules.md).
    this.kickoffTeam(otherTeam(scoringTeam));
  }

  /** Kickoff: reset positions, ball to center, designated team gets possession. */
  private kickoffTeam(team: Team): void {
    for (const p of this.players) {
      p.x = p.initialX;
      p.y = p.initialY;
      p.state = 'idle';
    }
    // Opponents pushed out of the center circle (game-rules.md).
    for (const p of this.players) {
      if (p.team === team) continue;
      const dx = p.x - CENTER_X;
      const dy = p.y - CENTER_Y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CENTER_CIRCLE_RADIUS) {
        if (dist === 0) {
          // Deterministic fallback for a player exactly on the center spot.
          p.x = CENTER_X - CENTER_CIRCLE_RADIUS;
          p.y = CENTER_Y;
        } else {
          p.x = CENTER_X + (dx / dist) * CENTER_CIRCLE_RADIUS;
          p.y = CENTER_Y + (dy / dist) * CENTER_CIRCLE_RADIUS;
        }
      }
    }
    this.ball.reset(CENTER_X, CENTER_Y);
    // Designated team receives possession: closest player to the ball.
    const candidates = this.players.filter((p) => p.team === team);
    if (candidates.length === 0) return;
    let closest = candidates[0] as PlayerEntity;
    let closestDist = this.distanceToBall(closest);
    for (const p of candidates) {
      const d = this.distanceToBall(p);
      if (d < closestDist) {
        closest = p;
        closestDist = d;
      } else if (d === closestDist && candidates.length > 1) {
        // Exact tie: the seeded RNG decides (game-rules.md contested rule).
        if (this.rng.next() < 0.5) {
          closest = p;
          closestDist = d;
        }
      }
    }
    this.ball.giveTo({ slot: closest.slot, team: closest.team });
  }

  private distanceToBall(p: PlayerEntity): number {
    const dx = p.x - this.ball.x;
    const dy = p.y - this.ball.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private recordFrame(tick: number): Frame {
    const frame: Frame = {
      index: tick,
      ball: { x: this.ball.x, y: this.ball.y },
      players: this.players.map(
        (p): FramePlayer => ({ slot: p.slot, team: p.team, x: p.x, y: p.y, state: p.state }),
      ),
      events: this.currentEvents,
      logs: this.currentLogs,
    };
    this.currentEvents = [];
    this.currentLogs = [];
    return frame;
  }

  private buildResult(): SimulationFrameFile['result'] {
    const winner =
      this.scoreChallengerValue > this.scoreOpponentValue
        ? 'challenger'
        : this.scoreChallengerValue < this.scoreOpponentValue
          ? 'opponent'
          : 'draw';
    return {
      score_challenger: this.scoreChallengerValue,
      score_opponent: this.scoreOpponentValue,
      winner,
    };
  }
}
