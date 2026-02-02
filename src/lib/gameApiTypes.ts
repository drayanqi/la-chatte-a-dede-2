/**
 * Game API Type Definitions for AI Script Autocomplete
 * OWNER: Dev Team
 *
 * These interfaces define the game objects available in AI scripts.
 * JSDoc comments are used to provide autocomplete descriptions in Monaco Editor.
 */

/**
 * Represents a 2D vector with x and y coordinates.
 * Used for positions and velocities in the game.
 */
export interface Vector2D {
  /** X coordinate on the pitch (horizontal position) */
  readonly x: number;
  /** Y coordinate on the pitch (vertical position) */
  readonly y: number;
}

/**
 * Represents a player on the pitch (can be controlled player, teammate, or opponent).
 * The `me` parameter is the player you control in the update function.
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
   * Current velocity of the player (direction and speed of movement).
   * @example
   * if (me.velocity.x > 0) {
   *   // Player is moving right
   * }
   */
  readonly velocity: Vector2D;

  /**
   * Move the player toward the specified coordinates.
   * The player will accelerate toward this position.
   * @param x - Target X coordinate to move toward
   * @param y - Target Y coordinate to move toward
   * @example
   * // Move toward the ball
   * me.moveTo(ball.position.x, ball.position.y);
   */
  moveTo(x: number, y: number): void;

  /**
   * Kick the ball if close enough to it.
   * Only works when the player is near the ball.
   * @param force - Optional kick power (0-100, default: 50)
   * @param angle - Optional kick angle in radians (default: toward goal)
   * @example
   * // Simple kick toward goal
   * me.kick();
   *
   * // Powerful kick at 45 degrees
   * me.kick(100, Math.PI / 4);
   */
  kick(force?: number, angle?: number): void;

  /**
   * Check if this player is the closest to the ball among teammates.
   * Useful for deciding who should go for the ball.
   * @returns true if this player is closest to the ball
   * @example
   * if (me.isClosestToBall()) {
   *   me.moveTo(ball.position.x, ball.position.y);
   * }
   */
  isClosestToBall(): boolean;
}

/**
 * Represents the ball on the pitch.
 */
export interface Ball {
  /**
   * Current position of the ball on the pitch.
   * @example
   * me.moveTo(ball.position.x, ball.position.y);
   */
  readonly position: Vector2D;

  /**
   * Current velocity of the ball (direction and speed of movement).
   * @example
   * // Predict where the ball will be
   * const futureX = ball.position.x + ball.velocity.x * 10;
   */
  readonly velocity: Vector2D;
}

/**
 * Represents a goal on the pitch.
 * There are two goals: yours (to defend) and the opponent's (to attack).
 */
export interface Goal {
  /**
   * Position of the center of the goal.
   * @example
   * // Kick toward the goal
   * const dx = goal.position.x - ball.position.x;
   * const dy = goal.position.y - ball.position.y;
   * const angle = Math.atan2(dy, dx);
   */
  readonly position: Vector2D;

  /**
   * Width of the goal opening.
   * @example
   * // Aim at a random point within the goal
   * const targetY = goal.position.y + (Math.random() - 0.5) * goal.width;
   */
  readonly width: number;
}

/**
 * The main update function signature that AI scripts must implement.
 * This function is called every frame (60 times per second) during a match.
 *
 * @param me - The player you control
 * @param ball - The ball object
 * @param teammates - Array of your teammate players (excluding yourself)
 * @param opponents - Array of opponent players
 * @param goal - The opponent's goal (where you want to score)
 *
 * @example
 * function update(me, ball, teammates, opponents, goal) {
 *   if (me.isClosestToBall()) {
 *     me.moveTo(ball.position.x, ball.position.y);
 *     me.kick(100);
 *   } else {
 *     // Move to defensive position
 *     me.moveTo(me.position.x, goal.position.y);
 *   }
 * }
 */
export type UpdateFunction = (
  me: Player,
  ball: Ball,
  teammates: Player[],
  opponents: Player[],
  goal: Goal
) => void;
