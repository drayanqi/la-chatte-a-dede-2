import {
  BALL_FRICTION,
  CENTER_X,
  CENTER_Y,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_Y_MAX,
  GOAL_Y_MIN,
  MAX_BALL_SPEED,
  MIN_BALL_SPEED,
} from './constants.js';
import type { Team } from './types.js';

export interface BallOwner {
  slot: number;
  team: Team;
}

/** The tick's trajectory crossed a goal line inside the mouth (side: right = x=100, left = x=0). */
export interface GoalLineCrossing {
  side: 'left' | 'right';
  y: number;
}

const WALL_CLAMP = 0.1;

/**
 * Ball physics and possession state.
 *
 * A free ball integrates velocity with friction and edge rebounds each tick.
 * An owned ball is stationary until the owner dribbles (Simulation syncs the
 * position), and can only be lost via moveToward (release) or shoot.
 */
export class BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: BallOwner | null;
  /** Last player who touched the ball (possession or shot) - used for scorer attribution. */
  lastTouch: BallOwner | null;
  /**
   * Player who released the ball (moveToward drop or shoot). Exempt from
   * possession checks while within COLLISION_RADIUS of the ball, so a shot is
   * not instantly re-collected by the shooter and a dropped ball stays lost.
   * Cleared once the releaser is out of reach (or on giveTo/reset).
   */
  releasedBy: BallOwner | null;
  /**
   * Goal-line crossing detected during the last step(): the movement segment
   * crossed x=0 or x=100 inside the goal mouth. The Simulation consumes this
   * for scoring; it is reset at the start of every step.
   */
  goalCrossing: GoalLineCrossing | null;

  constructor(x: number = CENTER_X, y: number = CENTER_Y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.owner = null;
    this.lastTouch = null;
    this.releasedBy = null;
    this.goalCrossing = null;
  }

  get isFree(): boolean {
    return this.owner === null;
  }

  /** Grants possession; the ball keeps its current position until dribbled. */
  giveTo(owner: BallOwner): void {
    this.owner = owner;
    this.lastTouch = owner;
    this.releasedBy = null;
  }

  /** Drops the ball in place: possession lost, velocity zeroed. */
  release(): void {
    if (this.owner !== null) this.releasedBy = this.owner;
    this.owner = null;
    this.vx = 0;
    this.vy = 0;
  }

  /** Kicks the ball toward (tx, ty) at MAX_BALL_SPEED and releases possession. */
  shoot(tx: number, ty: number): void {
    if (this.owner !== null) this.releasedBy = this.owner;
    this.owner = null;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) {
      // Deterministic fallback when the target equals the ball position.
      this.vx = MAX_BALL_SPEED;
      this.vy = 0;
    } else {
      this.vx = (dx / dist) * MAX_BALL_SPEED;
      this.vy = (dy / dist) * MAX_BALL_SPEED;
    }
  }

  /** Places the ball at a position with zero velocity and no owner (kickoff). */
  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.owner = null;
    this.releasedBy = null;
  }

  /** One physics step. Owned balls do not integrate (dribble sync is external). */
  step(): void {
    this.goalCrossing = null;
    if (this.owner !== null) return;
    const prevX = this.x;
    const prevY = this.y;
    this.x += this.vx;
    this.y += this.vy;
    this.applyFriction();
    this.applyRebounds(prevX, prevY);
  }

  private applyFriction(): void {
    this.vx *= BALL_FRICTION;
    this.vy *= BALL_FRICTION;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed < MIN_BALL_SPEED) {
      this.vx = 0;
      this.vy = 0;
    }
  }

  private applyRebounds(prevX: number, prevY: number): void {
    // Side edges always rebound (no throw-ins).
    if (this.y <= 0) {
      this.y = WALL_CLAMP;
      if (this.vy < 0) this.vy = -this.vy;
    } else if (this.y >= FIELD_HEIGHT) {
      this.y = FIELD_HEIGHT - WALL_CLAMP;
      if (this.vy > 0) this.vy = -this.vy;
    }
    // Goal lines: the trajectory's crossing point decides goal vs rebound
    // (the ball moves up to MAX_BALL_SPEED per tick, so judging by the
    // end-of-tick position alone produces phantom goals and rebounds at the
    // posts).
    if (prevX < FIELD_WIDTH && this.x >= FIELD_WIDTH) {
      const crossingY = this.crossingY(prevX, prevY, FIELD_WIDTH);
      if (crossingY >= GOAL_Y_MIN && crossingY <= GOAL_Y_MAX) {
        this.goalCrossing = { side: 'right', y: crossingY };
      } else {
        this.x = FIELD_WIDTH - WALL_CLAMP;
        if (this.vx > 0) this.vx = -this.vx;
      }
    } else if (prevX > 0 && this.x <= 0) {
      const crossingY = this.crossingY(prevX, prevY, 0);
      if (crossingY >= GOAL_Y_MIN && crossingY <= GOAL_Y_MAX) {
        this.goalCrossing = { side: 'left', y: crossingY };
      } else {
        this.x = WALL_CLAMP;
        if (this.vx < 0) this.vx = -this.vx;
      }
    }
  }

  /** y coordinate where this tick's movement segment crosses the vertical line x=lineX. */
  private crossingY(prevX: number, prevY: number, lineX: number): number {
    const t = (lineX - prevX) / (this.x - prevX);
    return prevY + t * (this.y - prevY);
  }
}
