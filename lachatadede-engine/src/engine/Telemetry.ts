import { BALL_FRICTION, FIELD_WIDTH, GOAL_Y_MAX, GOAL_Y_MIN, MAX_BALL_SPEED, MIN_BALL_SPEED } from './constants.js';
import type { BallOwner } from './BallState.js';
import type { MatchStats, PlayerStats, Team, TeamStats, TurnoverEvent } from './types.js';

/** Possession timeline bin size: 300 ticks = 5 seconds of play */
export const POSSESSION_BIN_TICKS = 300;

/** Hard cap for the on-target trajectory projection (friction stops ~80 ticks) */
const ON_TARGET_MAX_TICKS = 500;

/**
 * Match telemetry accumulator (story 7.9) — an OBSERVATION layer.
 *
 * Laws (locked in party session + game-rules.md determinism):
 * - Pure observation: counters are written at the Simulation's existing
 *   routing points and NEVER read by decision logic. O(1) per tick.
 * - Turnover = CAMP change only (Pelo's law): the ball passing from one
 *   team's possession to the OTHER team's. A teammate pickup continues the
 *   same camp's possession; kickoffs are restarts, never recoveries.
 * - Shot law (Pelo, 2026-09-22): a TIR is an ON-TARGET kick only. Every
 *   other kick is a PASSE; a pass succeeds when the ball's next possession
 *   stays in the kicking team's camp (teammate or self), fails otherwise.
 *   The ball still in flight at the final whistle never connected.
 * - Dribbles are NOT counted (Pelo, 2026-09-22): carrying the ball is
 *   movement, not an event worth a stat.
 * - Possession = ticks where the ball owner belongs to the team (engine
 *   truth via BallState, never proximity heuristics).
 * - Determinism: arrays only for player rows (JSON key order would risk
 *   byte-identity), fixed operation order, no clock.
 */
export class Telemetry {
  private readonly teams: Record<Team, TeamStats>;
  private readonly players: PlayerStats[];
  private readonly playerIndex: Map<string, PlayerStats>;
  /**
   * Team that last HAD possession (owned the ball). A shot or a drop keeps
   * the camp: the ball is loose but the camp has not changed until someone
   * else wins it.
   */
  private lastPossessionTeam: Team | null = null;
  /** The pass in flight (last off-target kick) — resolved on the next possession */
  private pendingPass: { team: Team; slot: number } | null = null;
  /** Per-bin possession tick counters, challenger then opponent */
  private readonly binChallenger: number[] = [];
  private readonly binOpponent: number[] = [];
  private binCount = 0;

  constructor() {
    this.teams = {
      challenger: { possessionTicks: 0, shots: 0, passes: 0, passesCompleted: 0, turnovers: 0 },
      opponent: { possessionTicks: 0, shots: 0, passes: 0, passesCompleted: 0, turnovers: 0 },
    };
    this.players = [];
    this.playerIndex = new Map();
  }

  /** Private player row access — creates the row on first touch (payload order). */
  private player(team: Team, slot: number): PlayerStats {
    const key = `${team}:${slot}`;
    let row = this.playerIndex.get(key);
    if (row === undefined) {
      row = { team, slot, distance: 0, shots: 0 };
      this.playerIndex.set(key, row);
      this.players.push(row);
    }
    return row;
  }

  /**
   * Kickoffs are restarts: the camp resumes at the kickoff team WITHOUT a
   * turnover count (the conceding team's engagement is not a recovery).
   */
  noteKickoff(team: Team): void {
    this.lastPossessionTeam = team;
  }

  /** One possession tick for the ball's current owner (null owner = free ball). */
  recordPossessionTick(owner: BallOwner | null, tick: number): void {
    // Pass resolution (shot law): the next possession after an off-target
    // kick decides it — same camp = completed, other camp = intercepted.
    // A null owner (ball in flight) keeps the pass pending.
    if (this.pendingPass !== null && owner !== null) {
      if (owner.team === this.pendingPass.team) this.teams[owner.team].passesCompleted++;
      this.pendingPass = null;
    }
    if (owner === null) return;
    this.teams[owner.team].possessionTicks++;
    const bin = Math.floor(tick / POSSESSION_BIN_TICKS);
    if (owner.team === 'challenger') this.binChallenger[bin] = (this.binChallenger[bin] ?? 0) + 1;
    else this.binOpponent[bin] = (this.binOpponent[bin] ?? 0) + 1;
    if (bin >= this.binCount) this.binCount = bin + 1;
  }

  /**
   * Registers a possession gain (checkPossession's giveTo). Returns a
   * turnover event when the ball changed camp — null otherwise (free start,
   * teammate pickup, same-team gain).
   */
  registerGain(owner: BallOwner): TurnoverEvent | null {
    const previous = this.lastPossessionTeam;
    this.lastPossessionTeam = owner.team;
    if (previous === null || previous === owner.team) return null;
    this.teams[owner.team].turnovers++;
    return { type: 'turnover', team: owner.team, takerSlot: owner.slot, fromTeam: previous };
  }

  /**
   * A kick while owning the ball (shot law): on-target = TIR, off-target =
   * PASSE. The pass stays pending until the next possession tick decides
   * its completion; a pass still pending at finalize simply never connected.
   */
  recordShot(team: Team, slot: number, onTarget: boolean): void {
    if (onTarget) {
      this.teams[team].shots++;
      this.player(team, slot).shots++;
    } else {
      this.teams[team].passes++;
      this.pendingPass = { team, slot };
    }
  }

  /** Actual distance moved this tick for one player (field units). */
  recordMove(team: Team, slot: number, distance: number): void {
    if (!(distance > 0)) return;
    this.player(team, slot).distance += distance;
  }

  /** Final aggregate — possession timeline in challenger share % per bin. */
  finalize(): MatchStats {
    const timeline: number[] = [];
    for (let bin = 0; bin < this.binCount; bin++) {
      const c = this.binChallenger[bin] ?? 0;
      const o = this.binOpponent[bin] ?? 0;
      const total = c + o;
      timeline.push(total === 0 ? 50 : Math.round((c / total) * 100));
    }
    return {
      teams: {
        challenger: { ...this.teams.challenger },
        opponent: { ...this.teams.opponent },
      },
      players: this.players.map((p) => ({ ...p })),
      possessionTimeline: timeline,
    };
  }
}

/**
 * Honest on-target projection (story 7.9): integrates the shot's DIRECT
 * trajectory (MAX_BALL_SPEED scaled by power, BALL_FRICTION decay, stop at
 * MIN_BALL_SPEED) and reports whether it crosses a goal line inside the
 * mouth before stopping. Rebounds and interceptions are ignored by
 * definition — this is the shot's intention, not its outcome (the goal
 * event stays the outcome's truth).
 */
export function isShotOnTarget(
  fromX: number,
  fromY: number,
  targetX: number,
  targetY: number,
  power: number
): boolean {
  const speed = power * MAX_BALL_SPEED;
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let vx: number;
  let vy: number;
  if (dist === 0) {
    vx = speed;
    vy = 0;
  } else {
    vx = (dx / dist) * speed;
    vy = (dy / dist) * speed;
  }
  let x = fromX;
  let y = fromY;
  for (let i = 0; i < ON_TARGET_MAX_TICKS; i++) {
    const prevX = x;
    const prevY = y;
    x += vx;
    y += vy;
    if (prevX < FIELD_WIDTH && x >= FIELD_WIDTH) {
      return crossingInMouth(prevX, prevY, x, y, FIELD_WIDTH);
    }
    // A shot from exactly ON the goal line (player clamped at x = 100) moves
    // outward without ever satisfying prevX < FIELD_WIDTH — count it too.
    if (prevX === FIELD_WIDTH && x > FIELD_WIDTH) {
      return crossingInMouth(prevX, prevY, x, y, FIELD_WIDTH);
    }
    if (prevX > 0 && x <= 0) {
      return crossingInMouth(prevX, prevY, x, y, 0);
    }
    if (prevX === 0 && x < 0) {
      return crossingInMouth(prevX, prevY, x, y, 0);
    }
    vx *= BALL_FRICTION;
    vy *= BALL_FRICTION;
    if (Math.sqrt(vx * vx + vy * vy) < MIN_BALL_SPEED) return false;
  }
  return false;
}

function crossingInMouth(prevX: number, prevY: number, x: number, y: number, lineX: number): boolean {
  const t = (lineX - prevX) / (x - prevX);
  const crossY = prevY + t * (y - prevY);
  return crossY >= GOAL_Y_MIN && crossY <= GOAL_Y_MAX;
}
