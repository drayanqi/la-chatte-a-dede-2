/**
 * Game API Type Definitions for AI Script IntelliSense
 * OWNER: Dev Team
 *
 * Canonical AI API contract (script-ia-api.md v3.0, validated by Pelo).
 * The engine calls `update(game)` every tick. This single source is consumed
 * two ways: as ambient declarations for Monaco's TypeScript worker
 * (src/lib/gameApiDts.ts -> monacoSetup.ts), which provides hover docs,
 * signature help and completions in the editor; and by tests asserting the
 * engine shim stays aligned with it.
 *
 * THE MIRROR LAW (v3.0): every script lives in its own attacking frame.
 * Your own goal is ALWAYS at x=0, the opponent goal ALWAYS at x=100, and
 * you ALWAYS attack from left to right — no matter which side of the pitch
 * your team plays on. The engine mirrors the pitch for you behind the
 * scenes; scripts never see or compute a home/away distinction.
 */

/**
 * Represents a 2D position on the pitch, in your attacking frame.
 * X ranges from 0 (YOUR goal line) to 100 (the opponent goal line).
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
   * Current position of the player on the pitch, in your attacking frame.
   * @example
   * const myPos = me.position;
   * console.log(`Player at (${myPos.x}, ${myPos.y})`);
   */
  readonly position: Vector2D;

  /**
   * Slot of the player in their team, from 1 (goalkeeper) to 5 (attacker).
   * @example
   * if (me.slot === 1) {
   *   // I am the goalkeeper: stay close to my own goal (x=0)
   * }
   */
  readonly slot: number;

  /**
   * Whether this player is on YOUR team (true for you and your teammates,
   * false for opponents).
   * @example
   * const friends = [...game.teammates, game.me].filter((p) => p.isTeammate);
   */
  readonly isTeammate: boolean;
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
   * @param x - Target X coordinate (0-100, your goal at 0)
   * @param y - Target Y coordinate (0-50)
   * @example
   * me.moveToward(ball.position.x, ball.position.y);
   */
  moveToward(x: number, y: number): void;

  /**
   * Move the player toward the specified coordinates WITH the ball.
   * The ball follows the player. Warning if the player has no ball.
   * @param x - Target X coordinate (0-100, your goal at 0)
   * @param y - Target Y coordinate (0-50)
   * @example
   * me.dribble(90, 30); // Carry the ball toward the opponent goal
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
   * at `power * 1.76` units per tick and decays with friction (~0.9583/tick),
   * so it can be intercepted. Warning if the player has no ball.
   * @param x - Target X coordinate (0-100, the opponent goal is at x=100)
   * @param y - Target Y coordinate (0-50)
   * @param power - Shot power between 0.1 and 1.0
   * @example
   * me.shoot(100, 25, 1.0); // Full-power shot at the opponent goal center
   */
  shoot(x: number, y: number, power: number): void;
}

/**
 * Represents the ball on the pitch.
 */
export interface Ball {
  /**
   * Current position of the ball on the pitch, in your attacking frame.
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
   * The player currently holding the ball, or null when the ball is free.
   * It is the ACTUAL player object, so identity checks work directly:
   * `ball.owner === me` (you have it), `ball.owner.isTeammate` (a teammate
   * has it). Valid for the current tick only.
   * @example
   * if (ball.owner === me) {
   *   me.shoot(100, 25, 1.0); // I have the ball: shoot at the opponent goal
   * } else if (ball.owner === null) {
   *   me.moveToward(ball.position.x, ball.position.y); // Free ball: go get it
   * }
   */
  readonly owner: Player | null;
}

/**
 * Represents a goal on the pitch, in your attacking frame.
 */
export interface Goal {
  /** X coordinate of the goal line (0 for your goal, 100 for the opponent goal) */
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
 * Represents the pitch: dimensions, goals and zones, in your attacking
 * frame. Identical for every seat: your own goal is always at x=0.
 */
export interface Field {
  /** Pitch width (100) */
  readonly width: number;
  /** Pitch height (50) */
  readonly height: number;
  /** YOUR goal: always at x=0 — defend it */
  readonly ownGoal: Goal;
  /** The opponent goal: always at x=100 — attack it */
  readonly opponentGoal: Goal;
  /** Your penalty box: the zone to defend around your own goal */
  readonly ownBox: Zone;
  /** The opponent penalty box: the zone to attack around their goal */
  readonly opponentBox: Zone;
  /** The center spot of the pitch (50, 25) */
  readonly center: Vector2D;
}

/**
 * The game context passed to your AI script on every tick (60 per second).
 * It is also available as the sandbox global `game` (see below).
 *
 * Your own goal is ALWAYS at x=0 and you ALWAYS attack toward x=100,
 * whichever side you play on — the engine mirrors the pitch for you.
 *
 * @example
 * function update() {
 *   const { me, ball, field } = game;
 *
 *   if (ball.owner === me) {
 *     me.dribble(field.opponentGoal.x, 25); // Carry the ball to the goal
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
  /** The pitch: dimensions, goals and zones, in your attacking frame */
  readonly field: Field;
}

/**
 * Sandbox global holding the CURRENT tick's game state: the shim assigns it
 * before calling update() and rebinds it on every tick, so helper functions
 * can read `game` directly, without receiving it as a parameter. Do not use
 * it at the top level (it is only defined once a tick runs). Declared here
 * WITHOUT export so the generated editor d.ts makes it a plain global.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed by the generated editor d.ts, not by this module
declare const game: Game;

/**
 * The main update function signature that AI scripts must implement.
 * This function is called every tick (60 times per second) during a match.
 *
 * @param game - The game state (me, ball, teammates, opponents, field)
 */
export type UpdateFunction = (game: Game) => void;
