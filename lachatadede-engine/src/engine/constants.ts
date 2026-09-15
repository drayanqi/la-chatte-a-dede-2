// Game constants - copied EXACTLY from game-rules.md (authoritative, validated by Pelo 2026-01-19).
// Any change to these values must happen in game-rules.md first.

// Duration
export const MATCH_DURATION_SECONDS = 180; // 3 minutes
export const TICKS_PER_SECOND = 60;
export const TOTAL_TICKS = 10800; // 180 * 60

// Field
export const FIELD_WIDTH = 100;
export const FIELD_HEIGHT = 50;

// Goals
export const GOAL_Y_MIN = 15;
export const GOAL_Y_MAX = 35;
export const GOAL_WIDTH = 20; // 35 - 15

// Center spot (default ball position)
export const CENTER_X = 50;
export const CENTER_Y = 25;

// Players
export const PLAYER_SPEED = 1.0;
export const CARRIER_SPEED_MULTIPLIER = 0.8; // dribble speed while carrying the ball
export const PLAYERS_PER_TEAM = 5;

// Ball
export const MAX_BALL_SPEED = 5.0;
export const BALL_FRICTION = 0.95;
export const MIN_BALL_SPEED = 0.1;
export const COLLISION_RADIUS = 2.0;
// A tackled player cannot take (or tackle) any ball for 3 s (180 ticks).
export const POSSESSION_LOCKOUT_TICKS = 180;

// Sandboxing (script-ia-api.md + backend-architecture.md "Limites Sandboxing")
export const TICK_TIMEOUT_MS = 10; // per-tick script deadline
export const MEMORY_LIMIT_MB = 8; // per-script heap limit
export const MATCH_TIME_BUDGET_MS = 30_000; // total simulation hard cap
export const SCRIPT_INIT_TIMEOUT_MS = 1_000; // top-level script init deadline
export const SHOOT_POWER_MIN = 0.1;
export const SHOOT_POWER_MAX = 1.0;
export const MAX_LOGS_PER_MATCH = 10_000; // frame-log cap across the whole match
export const MAX_LOG_MESSAGE_LENGTH = 500; // per-entry message truncation

// Ranking points
export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;
export const POINTS_LOSS = -1;
