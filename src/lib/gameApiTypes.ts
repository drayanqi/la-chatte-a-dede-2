/**
 * Game API Type Definitions for AI Script IntelliSense
 * OWNER: Dev Team
 *
 * Canonical AI API contract (script-ia-api.md v2.0, validated by Pelo).
 * The engine calls `update(game)` every tick. This single source is consumed
 * two ways: as ambient declarations for Monaco's TypeScript worker
 * (src/lib/gameApiDts.ts -> monacoSetup.ts), which provides hover docs,
 * signature help and completions in the editor; and by tests asserting the
 * engine shim stays aligned with it.
 */

/**
 * Represents a 2D position on the pitch.
 * X ranges from 0 (home goal line) to 100 (away goal line).
 */
export interface Vector2D {
  /** X coordinate on the pitch (horizontal position) */
  readonly x: number;
  /** Y coordinate on the pitch (vertical position) */
  readonly y: number;
}

/**
 * Represents a player on the pitch, as seen for teammates and opponents:
 * read-only observation only. Action methods exist solely on `me`
 * (see {@link SelfPlayer}), exactly as the engine shim attaches them.
 */
export interface Player {
  /**
   * Current position of the player on the pitch.
   * @example
   * const myPos = me.position;
   * console.log(`Player at (${myPos.x}, ${myPos.y})`);
   */
  readonly position: Vector2D;

  /**
   * Whether this player currently holds the ball.
   * @example
   * if (me.hasBall) {
   *   me.shoot(100, 25, 1.0);
   * }
   */
  readonly hasBall: boolean;

  /**
   * Slot of the player in their team, from 1 (goalkeeper) to 5 (attacker).
   * @example
   * if (me.slot === 1) {
   *   // I am the goalkeeper: stay close to my goal
   * }
   */
  readonly slot: number;

  /**
   * Team of the player: 'home' (your team) or 'away' (opponents).
   * @example
   * const goalX = me.team === 'home' ? 100 : 0;
   */
  readonly team: 'home' | 'away';

  /**
   * Check if this player is the closest to the ball among teammates
   * (engine-computed, ties resolved by the lower slot).
   * @returns true if this player is closest to the ball
   * @example
   * if (me.isClosestToBall()) {
   *   me.moveToward(ball.position.x, ball.position.y);
   * }
   */
  isClosestToBall(): boolean;
}

/**
 * The player your script controls (`game.me`): a {@link Player} that can
 * also act. Only the FIRST action per tick applies.
 */
export interface SelfPlayer extends Player {
  /**
   * Move the player toward the specified coordinates WITHOUT the ball.
   * If the player had the ball, it is dropped at the current position.
   * Only the first action per tick applies.
   * @param x - Target X coordinate (0-100)
   * @param y - Target Y coordinate (0-50)
   * @example
   * me.moveToward(ball.position.x, ball.position.y);
   */
  moveToward(x: number, y: number): void;

  /**
   * Move the player toward the specified coordinates WITH the ball.
   * The ball follows the player. Warning if the player has no ball.
   * @param x - Target X coordinate (0-100)
   * @param y - Target Y coordinate (0-50)
   * @example
   * me.dribble(75, 30);
   */
  dribble(x: number, y: number): void;

  /**
   * Stop the player immediately. The player keeps the ball if they had it.
   * @example
   * me.stop();
   */
  stop(): void;

  /**
   * Shoot the ball toward a position. The ball travels in a straight line
   * at `power * 5` units per tick and can be intercepted.
   * Warning if the player has no ball.
   * @param x - Target X coordinate (0-100)
   * @param y - Target Y coordinate (0-50)
   * @param power - Shot power between 0.1 and 1.0
   * @example
   * me.shoot(100, 25, 1.0); // Full-power shot at the goal center
   */
  shoot(x: number, y: number, power: number): void;

  /**
   * Legacy alias of {@link moveToward}, kept for old scripts only.
   * @deprecated Use moveToward instead.
   */
  moveTo(x: number, y: number): void;
}

/**
 * Represents the ball on the pitch.
 */
export interface Ball {
  /**
   * Current position of the ball on the pitch.
   * @example
   * me.moveToward(ball.position.x, ball.position.y);
   */
  readonly position: Vector2D;

  /**
   * Current velocity of the ball in units per tick.
   * @example
   * // Predict where the ball will be in 10 ticks
   * const futureX = ball.position.x + ball.velocity.vx * 10;
   */
  readonly velocity: { readonly vx: number; readonly vy: number };

  /**
   * Id of the player owning the ball (e.g. "home-3" or "away-1"),
   * or null when the ball is free.
   * @example
   * if (ball.owner === null) {
   *   // Ball is free: go get it
   * }
   */
  readonly owner: string | null;
}

/**
 * Represents a goal on the pitch.
 */
export interface Goal {
  /** X coordinate of the goal line (0 for home, 100 for away) */
  readonly x: number;
  /** Y coordinate of the goal center (25) */
  readonly y: number;
  /** Width of the goal opening (20) */
  readonly width: number;
}

/**
 * A rectangular zone of the pitch.
 */
export interface Zone {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * Represents the pitch: dimensions, goals and zones.
 */
export interface Field {
  /** Pitch width (100) */
  readonly width: number;
  /** Pitch height (50) */
  readonly height: number;
  /** The two goals: home at x=0, away at x=100 */
  readonly goals: { readonly home: Goal; readonly away: Goal };
  /** Key zones: penalty boxes and the center spot */
  readonly zones: {
    readonly homeBox: Zone;
    readonly awayBox: Zone;
    readonly center: Vector2D;
  };
}

/**
 * The game context passed to your AI script on every tick (60 per second).
 *
 * @example
 * function update(game) {
 *   const { me, ball, field } = game;
 *   const goalX = me.team === 'home' ? 100 : 0;
 *
 *   if (me.hasBall) {
 *     me.dribble(goalX, 25);
 *   } else {
 *     me.moveToward(ball.position.x, ball.position.y);
 *   }
 * }
 */
export interface Game {
  /** The player this script controls (the only one with action methods) */
  readonly me: SelfPlayer;
  /** The ball */
  readonly ball: Ball;
  /** Your teammates, excluding yourself (read-only) */
  readonly teammates: Player[];
  /** The opponents (read-only) */
  readonly opponents: Player[];
  /** The pitch: dimensions, goals and zones */
  readonly field: Field;
}

/**
 * The main update function signature that AI scripts must implement.
 * This function is called every tick (60 times per second) during a match.
 *
 * @param game - The game state (me, ball, teammates, opponents, field)
 */
export type UpdateFunction = (game: Game) => void;
