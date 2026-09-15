import { BallState, type BallOwner } from './BallState.js';
import {
  CARRIER_SPEED_MULTIPLIER,
  CENTER_X,
  CENTER_Y,
  COLLISION_RADIUS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_Y_MAX,
  GOAL_Y_MIN,
  PLAYER_SPEED,
  POSSESSION_LOCKOUT_TICKS,
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
  FrameLog,
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
  /** Tick until which the player cannot take (or tackle) any ball. -1 = never locked. */
  lockedUntilTick: number;
}

function otherTeam(team: Team): Team {
  return team === 'challenger' ? 'opponent' : 'challenger';
}

/**
 * Deterministic match simulation.
 *
 * Per game-rules.md v1.1 "Sequence de Jeu", every tick:
 *  1. seeded shuffle of the player execution order
 *  2. collect actions from the ScriptRunner
 *  3. apply actions
 *  4. update positions
 *  5. ball physics (friction, edge rebounds) - a released ball travels
 *     before it can be collected (game-rules.md v1.2)
 *  6. possession check (free-ball pickup or tackle), every tick
 *  7. goal check -> kickoff reset after a goal
 *  8. record frame
 *
 * Possession (game-rules.md v1.2): a free ball is collected by any player
 * within COLLISION_RADIUS of its post-physics position (seeded RNG if
 * contested; the shooter/releaser is exempt while within reach, so a shot
 * cannot be re-collected by its shooter at the release point and same-tick
 * blocks become interceptions at the ball's landing spot). An owned ball can
 * be tackled by any opponent within COLLISION_RADIUS; the tackled player then
 * cannot take any ball for POSSESSION_LOCKOUT_TICKS. Kickoffs grant the ball
 * to the kickoff team's goalkeeper and clear all lockouts.
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
  private currentLogs: FrameLog[] = [];

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
    // Script output (console capture, warnings, script errors) is frame data
    // consumed by the debug panel (story 3.10) - never just logged away.
    this.currentLogs.push(...outcome.logs);
    // 3-4. Apply actions and update positions.
    this.applyActions(outcome, order);
    // 5. Ball physics.
    this.ball.step();
    // 6. Possession check (free-ball pickup or tackle) - every tick.
    this.checkPossession();
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
    return {
      slot: p.slot,
      team,
      x: p.x,
      y: p.y,
      initialX: p.x,
      initialY: p.y,
      state: 'idle',
      lockedUntilTick: -1,
    };
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
        vx: this.ball.vx,
        vy: this.ball.vy,
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
        // Carrying the ball costs speed (game-rules.md v1.1): the owner
        // dribbles at CARRIER_SPEED_MULTIPLIER x PLAYER_SPEED, everyone else
        // (degenerate dribble without the ball) moves at full speed.
        this.movePlayer(
          player,
          action.x,
          action.y,
          this.isOwner(player) ? PLAYER_SPEED * CARRIER_SPEED_MULTIPLIER : PLAYER_SPEED,
        );
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
        if (this.isOwner(player)) this.ball.shoot(action.x, action.y, action.power);
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

  private movePlayer(player: PlayerEntity, tx: number, ty: number, speed = PLAYER_SPEED): void {
    const dx = tx - player.x;
    const dy = ty - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= speed) {
      player.x = tx;
      player.y = ty;
    } else {
      player.x += (dx / dist) * speed;
      player.y += (dy / dist) * speed;
    }
    // Players never leave the field; clamping also keeps a dribbled ball inside.
    player.x = Math.min(FIELD_WIDTH, Math.max(0, player.x));
    player.y = Math.min(FIELD_HEIGHT, Math.max(0, player.y));
  }

  private checkPossession(): void {
    const owner = this.ball.owner;
    const releaser = this.ball.releasedBy;
    // The release exemption expires once the releaser is out of reach, so a
    // shooter or dropper can collect the ball again later (tackles use the
    // timed lockout instead, game-rules.md v1.1).
    if (releaser !== null) {
      const releaserPlayer = this.players.find(
        (p) => p.slot === releaser.slot && p.team === releaser.team,
      );
      if (releaserPlayer === undefined || this.distanceToBall(releaserPlayer) > COLLISION_RADIUS) {
        this.ball.releasedBy = null;
      }
    }
    const currentTick = this.tick;
    // Players within COLLISION_RADIUS of the ball can take possession.
    const candidates = this.players.filter((p) => {
      // A recently tackled player cannot take any ball yet.
      if (p.lockedUntilTick > currentTick) return false;
      if (owner !== null) {
        // Tackle: only opponents of the carrier contest an owned ball;
        // teammates never take it from each other.
        return p.team !== owner.team && this.distanceToBall(p) <= COLLISION_RADIUS;
      }
      // Free ball: while the release exemption is active, the releaser cannot
      // re-collect the ball they dropped or shot.
      if (releaser !== null && p.slot === releaser.slot && p.team === releaser.team) {
        return false;
      }
      return this.distanceToBall(p) <= COLLISION_RADIUS;
    });
    if (candidates.length === 0) return;
    let winner: PlayerEntity;
    if (candidates.length === 1) {
      winner = candidates[0] as PlayerEntity;
    } else {
      // Contested possession: the seeded RNG decides (game-rules.md).
      winner = this.rng.shuffle(candidates)[0] as PlayerEntity;
    }
    if (owner !== null) {
      // The tackled player cannot take (or tackle) any ball for
      // POSSESSION_LOCKOUT_TICKS.
      const tackled = this.players.find((p) => p.slot === owner.slot && p.team === owner.team);
      if (tackled !== undefined) {
        tackled.lockedUntilTick = currentTick + POSSESSION_LOCKOUT_TICKS;
      }
    }
    const winnerOwner: BallOwner = { slot: winner.slot, team: winner.team };
    this.ball.giveTo(winnerOwner);
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

  /**
   * Kickoff (game-rules.md v1.1): reset positions, ball granted to the
   * kickoff team's goalkeeper at their tactic position, all possession
   * lockouts cleared.
   */
  private kickoffTeam(team: Team): void {
    for (const p of this.players) {
      p.x = p.initialX;
      p.y = p.initialY;
      p.state = 'idle';
      p.lockedUntilTick = -1;
    }
    const gk = this.players.find((p) => p.team === team && p.slot === 1);
    if (gk === undefined) {
      // Defensive fallback for a malformed payload without a slot-1 player.
      this.ball.reset(CENTER_X, CENTER_Y);
      return;
    }
    this.ball.reset(gk.initialX, gk.initialY);
    this.ball.giveTo({ slot: gk.slot, team: gk.team });
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
